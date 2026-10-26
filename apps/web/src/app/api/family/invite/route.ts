import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limiter'
import { authorizeInviteTarget, formatInviteResponse } from '@/lib/invite-authorization'
import { resolveRelativeRole } from '@/lib/onboarding'
import { isImpersonationSessionActive } from '@/lib/impersonation-guards'
import {
  getAuthUserFromRequest,
  getBaseUrlFromRequest,
  sendFamilyInviteEmail
} from '@/lib/family-invite-helpers'

export async function POST(request: Request) {
  try {
    const { user } = await getAuthUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
    }

    const cookieStore = await cookies()
    if (isImpersonationSessionActive(cookieStore, user)) {
      return NextResponse.json({ error: 'Operacja niedozwolona w trybie podglądu' }, { status: 403 })
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
    if (appRole !== 'org_admin' && appRole !== 'super_admin') {
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

    // Create invitation record
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

    const baseUrl = getBaseUrlFromRequest(request)
    const registerUrl = `${baseUrl}/register?token=${data.id}`
    const emailSent = await sendFamilyInviteEmail({
      email,
      orgId,
      registerUrl,
      adminClient
    })

    const isProduction = process.env.NODE_ENV === 'production'
    return NextResponse.json(
      formatInviteResponse({
        invitationId: data.id,
        registerUrl,
        isProduction,
        emailSent,
      })
    )
  } catch (error: unknown) {
    console.error('API error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Wystąpił błąd serwera' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await getAuthUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
    }

    const cookieStore = await cookies()
    if (isImpersonationSessionActive(cookieStore, user)) {
      return NextResponse.json({ error: 'Operacja niedozwolona w trybie podglądu' }, { status: 403 })
    }

    const appRole = user.app_metadata?.role
    if (appRole !== 'org_admin' && appRole !== 'super_admin') {
      return NextResponse.json({ error: 'Brak uprawnień administratora' }, { status: 403 })
    }

    const body = await request.json()
    const { id, action } = body

    if (!id || !action) {
      return NextResponse.json({ error: 'Brak identyfikatora zaproszenia lub akcji' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const userOrgId = user.app_metadata?.organization_id

    const { data: invitation, error: fetchErr } = await adminClient
      .from('resident_invitations')
      .select('*, residents(first_name, last_name, organization_id)')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !invitation) {
      return NextResponse.json({ error: 'Nie znaleziono zaproszenia' }, { status: 404 })
    }

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
      const baseUrl = getBaseUrlFromRequest(request)
      const registerUrl = `${baseUrl}/register?token=${invitation.id}`
      const emailSent = await sendFamilyInviteEmail({
        email: invitation.email || '',
        orgId: invitation.organization_id,
        registerUrl,
        adminClient
      })

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
  } catch (error: unknown) {
    console.error('API error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Wystąpił błąd serwera' }, { status: 500 })
  }
}
