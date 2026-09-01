import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=Brak+kodu+autoryzacji`)
  }

  const supabase = await createClient()

  // Wymieniamy kod na sesję
  const { error: sessionError, data: sessionData } = await supabase.auth.exchangeCodeForSession(code)

  if (sessionError || !sessionData.user) {
    return NextResponse.redirect(`${origin}/login?error=Błąd+logowania+przez+Google`)
  }

  const user = sessionData.user

  // Odczytujemy ciasteczka, szukając invite_token dla rodziny
  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map(c => {
      const parts = c.split('=')
      return [parts[0].trim(), decodeURIComponent(parts.slice(1).join('='))]
    }).filter(c => c[0])
  )

  const inviteToken = cookies['invite_token']

  // Jeśli użytkownik rejestrował się jako rodzina
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

      // 2. Aktualizacja app_metadata użytkownika
      const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
        user_metadata: {
          phone: invitation.phone || null
        },
        app_metadata: {
          role: 'family',
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
          relationship_code: 'family',
          role: 'family'
        })

      if (linkError && linkError.code !== '23505') {
        throw new Error('Błąd przypisywania do pensjonariusza.')
      }

      // 4. Konsumpcja zaproszenia
      await adminClient
        .from('resident_invitations')
        .update({ claimed_at: new Date().toISOString() })
        .eq('id', inviteToken)

      // Sukces, przekierowujemy czyszcząc ciastko
      const response = NextResponse.redirect(`${origin}/dashboard`)
      response.cookies.delete('invite_token')
      return response

    } catch (e: any) {
      console.error('Error during family oauth flow:', e)
      const errResponse = NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(e.message)}`)
      errResponse.cookies.delete('invite_token')
      return errResponse
    }
  }

  // W innym przypadku to normalne logowanie (np. personel lub już zarejestrowana rodzina)
  return NextResponse.redirect(`${origin}/dashboard`)
}
