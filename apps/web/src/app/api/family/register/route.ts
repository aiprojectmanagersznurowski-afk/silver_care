import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { token, password, consentsAccepted } = body

    if (!token || !password) {
      return NextResponse.json({ error: 'Brak tokena lub hasła' }, { status: 400 })
    }

    if (!consentsAccepted) {
      return NextResponse.json({ error: 'Akceptacja regulaminu i zgód jest wymagana' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 1. Validate token
    const { data: invitation, error: inviteError } = await adminClient
      .from('resident_invitations')
      .select('*')
      .eq('id', token)
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Nieprawidłowy token zaproszenia' }, { status: 400 })
    }

    if (invitation.claimed_at) {
      return NextResponse.json({ error: 'To zaproszenie zostało już zrealizowane' }, { status: 400 })
    }

    if (invitation.revoked_at) {
      return NextResponse.json({ error: 'To zaproszenie zostało odwołane' }, { status: 400 })
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'To zaproszenie wygasło' }, { status: 400 })
    }

    // 2. Create user via admin API
    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email: invitation.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        phone: invitation.phone || null
      },
      app_metadata: {
        role: 'family',
        organization_id: invitation.organization_id
      }
    })

    if (createError) {
      console.error(`User creation error:`, createError)
      return NextResponse.json({ error: 'Konto z tym e-mailem prawdopodobnie już istnieje.' }, { status: 400 })
    }

    const userId = userData.user.id

    // 3. Link user to resident
    const { error: linkError } = await adminClient
      .from('resident_relative_links')
      .insert({
        resident_id: invitation.resident_id,
        relative_user_id: userId,
        relationship_code: 'family',
        role: 'family'
      })

    if (linkError) {
      console.error(`Failed to link relative:`, linkError)
      // Cleanup? If we fail here, the system is in an inconsistent state. 
      // For MVP, we'll return an error but the user account is created.
      return NextResponse.json({ error: 'Konto utworzone, ale błąd przypisania do pensjonariusza.' }, { status: 500 })
    }

    // 4. Consume token
    const { error: consumeError } = await adminClient
      .from('resident_invitations')
      .update({ claimed_at: new Date().toISOString() })
      .eq('id', token)

    if (consumeError) {
      console.error(`Failed to consume token:`, consumeError)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Wystąpił nieoczekiwany błąd serwera' }, { status: 500 })
  }
}
