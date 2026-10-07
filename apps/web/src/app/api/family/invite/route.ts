import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limiter'
import { renderFamilyInviteEmail } from '@/lib/notification-templates'
import { authorizeInviteTarget, formatInviteResponse } from '@/lib/invite-authorization'
import { resolveRelativeRole } from '@/lib/onboarding'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined
    const supabase = await createClient(token)
    let user = null
    if (token) {
      const { data: authData } = await supabase.auth.getUser(token)
      user = authData?.user || null
    }
    if (!user) {
      const { data: cookieAuthData } = await supabase.auth.getUser()
      user = cookieAuthData?.user || null
    }
    
    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1'
    const rateCheck = checkRateLimit(`invite:${user.id || ip}`, 15, 60000)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Przekroczono limit wysyłki zaproszeń (max 15/min)' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) } }
      )
    }

    const appRole = user.app_metadata?.role

    if (appRole !== 'org_admin' && appRole !== 'admin' && appRole !== 'super_admin') {
      return NextResponse.json({ error: 'Brak uprawnień administratora' }, { status: 403 })
    }

    const body = await request.json()
    const { email, phone, resident_id, role } = body

    if (!email?.trim() || !resident_id) {
      return NextResponse.json({ error: 'Adres e-mail i ID podopiecznego są wymagane' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Klient admin omija RLS — przynależność podopiecznego do placówki z tokenu sprawdzamy jawnie
    const { data: resident } = await adminClient
      .from('residents')
      .select('organization_id')
      .eq('id', resident_id)
      .maybeSingle()

    const target = authorizeInviteTarget({
      appRole,
      tokenOrgId: user.app_metadata?.organization_id,
      residentOrgId: resident?.organization_id,
    })

    if (!target.ok) {
      return NextResponse.json({ error: 'Nie znaleziono podopiecznego' }, { status: target.status })
    }

    const orgId = target.organizationId
    const assignedRole = resolveRelativeRole(role)

    // Create invitation record (bypassing RLS for simplicity, but we still inject orgId)
    const { data, error } = await adminClient
      .from('resident_invitations')
      .insert({
        organization_id: orgId,
        resident_id: resident_id,
        role: assignedRole,
        email: email.trim(),
        phone: phone?.trim() || null
      })
      .select('id')
      .single()

    if (error) {
      console.error(`Invite insertion error:`, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send invitation email via Mailtrap
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`
    const registerUrl = `${baseUrl}/register?token=${data.id}`
    
    let emailSent = false
    if (process.env.EMAIL_PROVIDER_KEY) {
      console.log(`[EMAIL] Wysyłanie zaproszenia...`)

      // Pobierz nazwę placówki
      let orgName: string | undefined
      const { data: org } = await adminClient
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .maybeSingle()
      if (org?.name) orgName = org.name

      const emailTemplate = renderFamilyInviteEmail({ inviteUrl: registerUrl, organizationName: orgName })
      
      const emailRes = await fetch('https://send.api.mailtrap.io/api/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EMAIL_PROVIDER_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: [{ email: email.trim() }],
          from: { email: 'noreply@silvercare.space', name: 'Silver Care' },
          subject: emailTemplate.subject,
          text: emailTemplate.text,
          html: emailTemplate.html,
        })
      })

      if (!emailRes.ok) {
        const errorData = await emailRes.text()
        console.error('Błąd Mailtrap API:', errorData)
      } else {
        console.log(`[EMAIL] Zaproszenie wysłane pomyślnie.`)
        emailSent = true
      }
    } else {
      console.log(`[EMAIL] Brak EMAIL_PROVIDER_KEY. Zaproszenie wygenerowane pomyślnie.`)
    }

    const isProduction = process.env.NODE_ENV === 'production'
    return NextResponse.json(
      formatInviteResponse({
        invitationId: data.id,
        registerUrl,
        isProduction,
        emailSent,
      })
    )
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined
    const supabase = await createClient(token)
    let user = null
    if (token) {
      const { data: authData } = await supabase.auth.getUser(token)
      user = authData?.user || null
    }
    if (!user) {
      const { data: cookieAuthData } = await supabase.auth.getUser()
      user = cookieAuthData?.user || null
    }

    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
    }

    const appRole = user.app_metadata?.role
    if (appRole !== 'org_admin' && appRole !== 'admin' && appRole !== 'super_admin') {
      return NextResponse.json({ error: 'Brak uprawnień administratora' }, { status: 403 })
    }

    const body = await request.json()
    const { id, action } = body

    if (!id || !action) {
      return NextResponse.json({ error: 'Brak identyfikatora zaproszenia lub akcji' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const userOrgId = user.app_metadata?.organization_id

    // Pobierz zaproszenie
    const { data: invitation, error: fetchErr } = await adminClient
      .from('resident_invitations')
      .select('*, residents(first_name, last_name, organization_id)')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !invitation) {
      return NextResponse.json({ error: 'Nie znaleziono zaproszenia' }, { status: 404 })
    }

    // Sprawdzenie uprawnień do placówki
    if (appRole !== 'super_admin' && userOrgId && invitation.organization_id !== userOrgId) {
      return NextResponse.json({ error: 'Brak dostępu do zaproszenia z innej placówki' }, { status: 403 })
    }

    if (action === 'revoke') {
      if (invitation.claimed_at) {
        return NextResponse.json({ error: 'Nie można odwołać zrealizowanego zaproszenia' }, { status: 400 })
      }
      const { error: updateErr } = await adminClient
        .from('resident_invitations')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Zaproszenie zostało odwołane' })
    }

    if (action === 'resend') {
      const host = request.headers.get('host') || 'localhost:3000'
      const protocol = request.headers.get('x-forwarded-proto') || 'http'
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`
      const registerUrl = `${baseUrl}/register?token=${invitation.id}`

      let emailSent = false
      if (process.env.EMAIL_PROVIDER_KEY && invitation.email) {
        let orgName: string | undefined
        const { data: org } = await adminClient
          .from('organizations')
          .select('name')
          .eq('id', invitation.organization_id)
          .maybeSingle()
        if (org?.name) orgName = org.name

        const emailTemplate = renderFamilyInviteEmail({ inviteUrl: registerUrl, organizationName: orgName })
        const emailRes = await fetch('https://send.api.mailtrap.io/api/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.EMAIL_PROVIDER_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: [{ email: invitation.email.trim() }],
            from: { email: 'noreply@silvercare.space', name: 'Silver Care' },
            subject: emailTemplate.subject,
            text: emailTemplate.text,
            html: emailTemplate.html,
          })
        })

        if (!emailRes.ok) {
          const errorData = await emailRes.text()
          console.error('Błąd Mailtrap API:', errorData)
        } else {
          emailSent = true
        }
      }

      const isProduction = process.env.NODE_ENV === 'production'
      const formatted = formatInviteResponse({
        invitationId: invitation.id,
        registerUrl,
        isProduction,
        emailSent,
      })

      return NextResponse.json({ ...formatted, message: 'Wysłano ponownie e-mail z zaproszeniem' })
    }

    return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
