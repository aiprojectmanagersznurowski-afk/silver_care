import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveRelativeRole } from '@/lib/onboarding'
import { checkOAuthInviteRoleConflict } from '@/lib/auth-safety'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Brak kodu autoryzacji')}`)
  }

  const cookieStore = await cookies()
  const supabase = await createClient()

  // Wymieniamy kod na sesję
  const { error: sessionError, data: sessionData } = await supabase.auth.exchangeCodeForSession(code)

  if (sessionError || !sessionData.user) {
    const errorMsg = sessionError?.message || 'Błąd logowania przez Google'
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMsg)}`)
  }

  const user = sessionData.user

  // Odczytujemy ciasteczka, szukając invite_token dla rodziny
  const cookieHeader = request.headers.get('cookie') || ''
  const cookiesMap = Object.fromEntries(
    cookieHeader.split('; ').map(c => {
      const parts = c.split('=')
      return [parts[0].trim(), decodeURIComponent(parts.slice(1).join('='))]
    }).filter(c => c[0])
  )

  const inviteToken = cookiesMap['invite_token']

  // Jeśli użytkownik rejestrował się jako rodzina z zaproszeniem
  if (inviteToken) {
    try {
      const adminClient = createAdminClient()

      // 1. Walidacja tokena
      const { data: invitation, error: inviteError } = await adminClient
        .from('resident_invitations')
        .select('*')
        .eq('id', inviteToken)
        .single()

      if (inviteError || !invitation) {
        throw new Error('Nieprawidłowy token zaproszenia')
      }

      if (invitation.claimed_at) {
        throw new Error('To zaproszenie zostało już zrealizowane')
      }

      if (invitation.revoked_at) {
        throw new Error('To zaproszenie zostało odwołane')
      }

      if (new Date(invitation.expires_at) < new Date()) {
        throw new Error('To zaproszenie wygasło')
      }

      // Weryfikacja czy email z Google zgadza się z adresem zaproszenia (wymóg bezpieczeństwa)
      if (user.email !== invitation.email) {
        // Wyloguj jeśli maile się nie zgadzają, by zablokować token
        await supabase.auth.signOut()
        throw new Error('Adres e-mail z Google nie pokrywa się z zaproszeniem.')
      }

      // Weryfikacja ochrony istniejących ról personelu i administratora (SEC-OAUTH-METADATA-OVERWRITE)
      const conflictCheck = checkOAuthInviteRoleConflict({
        appRole: user.app_metadata?.role,
        userRole: user.user_metadata?.role,
      })

      if (conflictCheck.hasConflict) {
        await supabase.auth.signOut()
        throw new Error(conflictCheck.reason || 'Konto posiada już uprawnienia personelu placówki lub administratora.')
      }

      // 2. Aktualizacja app_metadata użytkownika — rola z zaproszenia, jak w /api/family/register (CONSENT-GRANTOR)
      const relativeRole = resolveRelativeRole(invitation.role)
      const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
        user_metadata: {
          phone: invitation.phone || null
        },
        app_metadata: {
          role: relativeRole,
          organization_id: invitation.organization_id
        }
      })

      if (updateError) {
        throw new Error('Błąd przypisywania uprawnień systemowych.')
      }

      // 3. Przypisanie do pensjonariusza
      const { error: linkError } = await adminClient
        .from('resident_relative_links')
        .insert({
          resident_id: invitation.resident_id,
          relative_user_id: user.id,
          relationship_code: relativeRole,
          role: relativeRole
        })

      if (linkError && linkError.code !== '23505') {
        throw new Error('Błąd przypisywania do pensjonariusza.')
      }

      // 4. Konsumpcja zaproszenia
      await adminClient
        .from('resident_invitations')
        .update({ claimed_at: new Date().toISOString() })
        .eq('id', inviteToken)

      // Sukces, przekierowujemy czyszcząc ciastko zaproszenia i utrwalając sesję
      const response = NextResponse.redirect(`${origin}/dashboard`)
      response.cookies.delete('invite_token')
      cookieStore.getAll().forEach(c => {
        response.cookies.set(c.name, c.value)
      })
      return response

    } catch (e: any) {
      console.error('Error during family oauth flow:', e)
      const errResponse = NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(e.message)}`)
      errResponse.cookies.delete('invite_token')
      return errResponse
    }
  }

  // Normalne logowanie — kierowanie wg roli z app_metadata
  const role = user.app_metadata?.role

  let destination = '/dashboard'
  if (role === 'super_admin' || role === 'org_admin' || role === 'admin' || role === 'facility_manager') {
    destination = '/admin'
  } else if (role === 'nurse' || role === 'paramedic' || role === 'caregiver') {
    destination = '/staff'
  } else if (role === 'family' || role === 'legal_guardian') {
    destination = '/dashboard'
  } else {
    // Użytkownik zalogował się kontem Google, które nie jest zarejestrowane w systemie
    await supabase.auth.signOut()
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Konto Google nie jest powiązane z żadnym profilem w systemie. Skontaktuj się z administratorem placówki.')}`
    )
  }

  const response = NextResponse.redirect(`${origin}${destination}`)
  cookieStore.getAll().forEach(c => {
    response.cookies.set(c.name, c.value)
  })
  return response
}

