import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Proste zabezpieczenie CRON (można rozszerzyć o weryfikację nagłówka z Vercel)
    const authHeader = request.headers.get('authorization')
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const adminClient = createAdminClient()

    // Pobierz powiadomienia do wysyłki (tylko 50 na raz, by uniknąć timeoutu)
    const { data: notifications, error: fetchError } = await adminClient
      .from('outbox_notifications')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(50)

    if (fetchError) {
      throw fetchError
    }

    if (!notifications || notifications.length === 0) {
      return NextResponse.json({ message: 'No pending notifications' })
    }

    const smsapiToken = process.env.SMSAPI_TOKEN
    
    // Iterujemy po powiadomieniach
    for (const notification of notifications) {
      try {
        let shouldMarkProcessed = true;

        // Obecnie obsługujemy tylko "report"
        if (notification.entity_type === 'report') {
          // Zdobądź resident_id z raportu
          const { data: report } = await adminClient
            .from('daily_reports')
            .select('resident_id')
            .eq('id', notification.entity_id)
            .single()

          if (report && report.resident_id) {
            // Znajdź rodzinę dla tego pensjonariusza
            const { data: familyLinks } = await adminClient
              .from('resident_relative_links')
              .select('relative_user_id')
              .eq('resident_id', report.resident_id)
              .eq('role', 'family')

            if (familyLinks && familyLinks.length > 0) {
              const host = request.headers.get('host') || 'localhost:3000'
              const protocol = request.headers.get('x-forwarded-proto') || 'http'
              const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`

              // Wiadomość neutralna (ADR-008)
              const smsMessage = `Nowy raport o Twoim bliskim jest dostepny w Silver Care. Zaloguj sie: ${baseUrl}/login`

              for (const link of familyLinks) {
                // Pobierz metadane usera żeby wyciągnąć telefon
                const { data: userData } = await adminClient.auth.admin.getUserById(link.relative_user_id)
                const phone = userData?.user?.user_metadata?.phone
                const email = userData?.user?.email
                
                // Wyślij SMS
                if (phone && smsapiToken) {
                  console.log(`Wysyłanie SMS do: [UKRYTY_NUMER]...`)
                  
                  const smsParams = new URLSearchParams()
                  smsParams.append('to', phone)
                  smsParams.append('from', 'Test') // lub nazwa nadawcy np. "SilverCare" jeśli zarejestrowana
                  smsParams.append('message', smsMessage)
                  smsParams.append('format', 'json')

                  const smsRes = await fetch('https://api.smsapi.pl/sms.do', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${smsapiToken}`,
                      'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: smsParams
                  })

                  const smsData = await smsRes.json()
                  if (!smsRes.ok || smsData.error) {
                    console.error(`Błąd SMSAPI dla nr [UKRYTY_NUMER]:`, smsData)
                  } else {
                    console.log(`SMS wysłany pomyślnie do [UKRYTY_NUMER].`)
                  }
                }

                // Wyślij E-mail
                const mailtrapToken = process.env.EMAIL_PROVIDER_KEY
                if (email && mailtrapToken) {
                  console.log(`Wysyłanie E-maila do: [UKRYTY_EMAIL]...`)
                  
                  const emailRes = await fetch('https://send.api.mailtrap.io/api/send', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${mailtrapToken}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      to: [{ email: email }],
                      from: { email: 'noreply@silvercare.space', name: 'Silver Care' },
                      subject: 'Nowy raport w Silver Care',
                      text: smsMessage
                    })
                  })

                  if (!emailRes.ok) {
                    const errorData = await emailRes.text()
                    console.error(`Błąd Mailtrap API dla [UKRYTY_EMAIL]:`, errorData)
                  } else {
                    console.log(`E-mail wysłany pomyślnie do [UKRYTY_EMAIL].`)
                  }
                }
              }
            }
          }
        }

        if (shouldMarkProcessed) {
          // Oznacz jako przetworzone
          await adminClient
            .from('outbox_notifications')
            .update({ status: 'PROCESSED' })
            .eq('id', notification.id)
        }
      } catch (err) {
        console.error(`Błąd przetwarzania powiadomienia ${notification.id}:`, err)
        // Oznacz jako FAILED
        await adminClient
          .from('outbox_notifications')
          .update({ status: 'FAILED' })
          .eq('id', notification.id)
      }
    }

    return NextResponse.json({ success: true, processed: notifications.length })
  } catch (error: any) {
    console.error('Błąd procesu outbox:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
