import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderReportPublishedEmail, renderReportPublishedSms } from '@/lib/notification-templates'

export const dynamic = 'force-dynamic'

interface OutboxRecord {
  id: string
  organization_id: string
  entity_type: string
  entity_id: string
  payload: { message?: string }
  status: string
  attempts: number
  max_attempts: number
}

interface FamilyLinkRecord {
  relative_user_id: string
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const adminClient = createAdminClient()

    // Atomowe pobieranie i blokowanie zadań przez SKIP LOCKED
    const { data: notifications, error: fetchError } = await adminClient
      .rpc('fetch_pending_outbox_notifications', {
        p_batch_size: 50,
        p_lock_timeout_minutes: 10,
      })

    if (fetchError) {
      throw fetchError
    }

    const records = (notifications as unknown as OutboxRecord[]) || []

    if (records.length === 0) {
      return NextResponse.json({ message: 'No pending notifications' })
    }

    const smsapiToken = process.env.SMSAPI_TOKEN
    const mailtrapToken = process.env.EMAIL_PROVIDER_KEY

    // Iterujemy po atomowo zarezerwowanych powiadomieniach
    for (const notification of records) {
      let success = true
      let errorMessage: string | null = null

      try {
        if (notification.entity_type === 'report') {
          // Pobierz resident_id z raportu
          const { data: report, error: reportErr } = await adminClient
            .from('daily_reports')
            .select('resident_id')
            .eq('id', notification.entity_id)
            .single()

          if (reportErr || !report?.resident_id) {
            throw new Error(`Report not found or missing resident_id: ${reportErr?.message || ''}`)
          }

          // Znajdź bliskich i opiekunów prawnych
          const { data: familyLinks } = await adminClient
            .from('resident_relative_links')
            .select('relative_user_id')
            .eq('resident_id', report.resident_id)
            .in('role', ['family', 'legal_guardian'])

          const links = (familyLinks as unknown as FamilyLinkRecord[]) || []

          if (links.length > 0) {
            const host = request.headers.get('host') || 'localhost:3000'
            const protocol = request.headers.get('x-forwarded-proto') || 'http'
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`

            // Pobierz nazwę placówki, jeśli dostępna
            let orgName: string | undefined
            if (notification.organization_id) {
              const { data: org } = await adminClient
                .from('organizations')
                .select('name')
                .eq('id', notification.organization_id)
                .maybeSingle()
              if (org?.name) {
                orgName = org.name
              }
            }

            const portalUrl = `${baseUrl}/login`
            const emailTemplate = renderReportPublishedEmail({ portalUrl, organizationName: orgName })
            const smsTemplate = renderReportPublishedSms({ portalUrl })

            for (const link of links) {
              const { data: userData } = await adminClient.auth.admin.getUserById(link.relative_user_id)
              const phone = userData?.user?.user_metadata?.phone
              const email = userData?.user?.email

              // Wysyłka SMS
              if (phone && smsapiToken) {
                console.log(`Wysyłanie SMS do: [UKRYTY_NUMER]...`)
                const smsParams = new URLSearchParams()
                smsParams.append('to', phone)
                smsParams.append('from', smsTemplate.sender)
                smsParams.append('message', smsTemplate.text)
                smsParams.append('format', 'json')

                const smsRes = await fetch('https://api.smsapi.pl/sms.do', {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${smsapiToken}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: smsParams,
                })

                const smsData = await smsRes.json().catch(() => ({}))
                if (!smsRes.ok || smsData.error) {
                  throw new Error(`SMSAPI failure code ${smsRes.status}`)
                }
              }

              // Wysyłka Email (HTML + Plain text fallback)
              if (email && mailtrapToken) {
                console.log(`Wysyłanie E-maila do: [UKRYTY_EMAIL]...`)
                const emailRes = await fetch('https://send.api.mailtrap.io/api/send', {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${mailtrapToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    to: [{ email }],
                    from: { email: 'noreply@silvercare.space', name: 'Silver Care' },
                    subject: emailTemplate.subject,
                    text: emailTemplate.text,
                    html: emailTemplate.html,
                  }),
                })

                if (!emailRes.ok) {
                  throw new Error(`Mailtrap failure code ${emailRes.status}`)
                }
              }
            }
          }
        }
      } catch (err: any) {
        success = false
        errorMessage = err?.message || 'Unknown processing error'
        console.error(`Błąd przetwarzania powiadomienia ${notification.id}:`, errorMessage)
      }

      // Aktualizacja statusu i ewentualne zaplanowanie retry z backoffem
      await adminClient.rpc('handle_outbox_notification_attempt', {
        p_notification_id: notification.id,
        p_success: success,
        p_error_message: errorMessage,
      })
    }

    return NextResponse.json({ success: true, processed: records.length })
  } catch (error: any) {
    console.error('Błąd procesu outbox:', error?.message || error)
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
  }
}
