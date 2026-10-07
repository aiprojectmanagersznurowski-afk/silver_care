import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveRelativeRole } from '@/lib/onboarding'
import { evaluateOAuthInviteClaim } from '@/lib/invite-authorization'

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
  const consentsAccepted = cookiesMap['invite_consents_accepted'] === 'true'

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

      // 2. Walidacja bezpieczeństwa realizacji zaproszenia (SEC-OAUTH-METADATA-OVERWRITE, OAUTH-GUARDIAN-CONSENTS)
      const claimEvaluation = evaluateOAuthInviteClaim({
        currentUserRole: user.app_metadata?.role,
        currentUserOrgId: user.app_metadata?.organization_id,
        invitationRole: invitation.role,
        invitationOrgId: invitation.organization_id,
        consentsAccepted,
      })

      if (!claimEvaluation.allowed) {
        if (claimEvaluation.errorCode === 'CONSENTS_REQUIRED') {
          const consentErrResponse = NextResponse.redirect(
            `${origin}/register?token=${encodeURIComponent(inviteToken)}&error=${encodeURIComponent(claimEvaluation.error)}`
          )
          consentErrResponse.cookies.delete('invite_consents_accepted')
          return consentErrResponse
        }
        throw new Error(claimEvaluation.error)
      }

      // Aktualizacja app_metadata następuje wyłącznie, gdy użytkownik nie ma roli lub awansuje (CONSENT-GRANTOR)
      if (claimEvaluation.isNewRoleAssignment) {
        const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
          user_metadata: {
            phone: invitation.phone || user.user_metadata?.phone || null,
          },
          app_metadata: {
            ...user.app_metadata,
            role: claimEvaluation.assignedRole,
            organization_id: claimEvaluation.organizationId,
          },
        })

        if (updateError) {
          throw new Error('Błąd przypisywania uprawnień systemowych.')
        }
      }

      // 3. Przypisanie do pensjonariusza
      const assignedLinkRole = resolveRelativeRole(invitation.role)
      const { error: linkError } = await adminClient
        .from('resident_relative_links')
        .insert({
          resident_id: invitation.resident_id,
          relative_user_id: user.id,
          relationship_code: assignedLinkRole,
          role: assignedLinkRole,
        })

      if (linkError && linkError.code !== '23505') {
        throw new Error('Błąd przypisywania do pensjonariusza.')
      }

      // 4. Rejestracja zgód Art. 9 RODO w consent_ledger dla opiekuna prawnego (CONSENT-GRANTOR)
      if (claimEvaluation.requiresConsentLedgerInsert) {
        const consentPurposes = ['wellness_data_ingest', 'family_view_basic']
        const consentInserts = consentPurposes.map(purpose => ({
          organization_id: invitation.organization_id,
          resident_id: invitation.resident_id,
          purpose,
          granted_by: 'legal_guardian',
        }))

        const { error: consentError } = await adminClient
          .from('consent_ledger')
          .insert(consentInserts)

        if (consentError) {
          console.error('Consent ledger error:', consentError)
        }
      }

      // 5. Konsumpcja zaproszenia
      await adminClient
        .from('resident_invitations')
        .update({ claimed_at: new Date().toISOString() })
        .eq('id', inviteToken)

      // 6. Zapis zdarzenia audytowego bez PII (SEC-NO-PII)
      await adminClient.from('audit_logs').insert({
        organization_id: invitation.organization_id,
        resident_id: invitation.resident_id,
        action: 'FAMILY_ACCOUNT_ACTIVATED',
        performed_by: user.id,
        payload: {
          role: claimEvaluation.assignedRole,
          auth_provider: 'google',
        },
      })

      // Sukces, przekierowujemy czyszcząc ciastka zaproszenia i utrwalając sesję
      const response = NextResponse.redirect(`${origin}/dashboard`)
      response.cookies.delete('invite_token')
      response.cookies.delete('invite_consents_accepted')
      cookieStore.getAll().forEach(c => {
        response.cookies.set(c.name, c.value)
      })
      return response

    } catch (e: any) {
      console.error('Error during family oauth flow:', e)
      const errResponse = NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(e.message)}`)
      errResponse.cookies.delete('invite_token')
      errResponse.cookies.delete('invite_consents_accepted')
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

