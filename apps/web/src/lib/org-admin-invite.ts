import { createAdminClient } from '@/lib/supabase/admin'
import { renderAdminInviteEmail } from '@/lib/notification-templates'

export async function sendAdminInviteEmail(
  adminEmail: string,
  orgName: string
): Promise<{ inviteUrl: string | null; emailSent: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://silvercare.space'

    let { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: adminEmail,
      options: {
        redirectTo: `${siteUrl}/login`
      }
    })

    if (linkErr) {
      const fallback = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: adminEmail,
        options: {
          redirectTo: `${siteUrl}/login`
        }
      })

      if (!fallback.error && fallback.data?.properties?.action_link) {
        linkData = fallback.data
        linkErr = null
      } else {
        const recoveryFallback = await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email: adminEmail,
          options: {
            redirectTo: `${siteUrl}/login`
          }
        })
        if (!recoveryFallback.error && recoveryFallback.data?.properties?.action_link) {
          linkData = recoveryFallback.data
          linkErr = null
        }
      }
    }

    if (linkErr || !linkData?.properties?.action_link) {
      console.error('[ADMIN_INVITE] Błąd generowania linku:', linkErr)
      return { inviteUrl: null, emailSent: false, error: linkErr?.message || 'Nie udało się wygenerować linku zaproszenia.' }
    }

    const actionLink = linkData.properties.action_link
    const inviteUrl = `${siteUrl}/accept-invite?url=${encodeURIComponent(actionLink)}`

    let emailSent = false
    const emailProviderKey = process.env.EMAIL_PROVIDER_KEY
    if (emailProviderKey) {
      try {
        const emailTemplate = renderAdminInviteEmail({ inviteUrl, organizationName: orgName })
        const emailRes = await fetch('https://send.api.mailtrap.io/api/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${emailProviderKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: [{ email: adminEmail }],
            from: { email: 'noreply@silvercare.space', name: 'Silver Care' },
            subject: emailTemplate.subject,
            text: emailTemplate.text,
            html: emailTemplate.html,
          })
        })

        if (emailRes.ok) {
          emailSent = true
          console.log(`[ADMIN_INVITE] E-mail z zaproszeniem wysłany pomyślnie do ${adminEmail}`)
        } else {
          const errBody = await emailRes.text()
          console.error(`[ADMIN_INVITE] Błąd wysyłki e-maila:`, errBody)
        }
      } catch (mailErr) {
        console.error('[ADMIN_INVITE] Wyjątek podczas wysyłki e-maila:', mailErr)
      }
    } else {
      console.log(`[MOCK EMAIL] Brak EMAIL_PROVIDER_KEY. Link zaproszenia administratora: ${inviteUrl}`)
    }

    return { inviteUrl, emailSent }
  } catch (err: unknown) {
    console.error('[ADMIN_INVITE] Nieoczekiwany błąd zaproszenia:', err)
    return { inviteUrl: null, emailSent: false, error: err instanceof Error ? err.message : 'Błąd zaproszenia.' }
  }
}

export async function executeAdminAssignment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingUser: any,
  orgId: string,
  orgName: string,
  adminEmail: string,
  adminFullName: string | null,
  callerUserId: string
) {
  let targetUserId = existingUser?.id

  if (existingUser) {
    // Rola i placówka tylko w app_metadata; stare wpisy z user_metadata usuwamy przy zapisie
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { role: _role, organization_id: _orgId, ...userMetadata } = existingUser.user_metadata ?? {}
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(existingUser.id, {
      app_metadata: {
        ...existingUser.app_metadata,
        role: 'org_admin',
        organization_id: orgId
      },
      user_metadata: {
        ...userMetadata,
        ...(adminFullName ? { full_name: adminFullName } : {})
      }
    })
    if (updateErr) {
      return { error: 'Błąd przypisywania roli: ' + updateErr.message }
    }
  } else {
    const { data: createdData, error: createErr } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      email_confirm: false,
      app_metadata: {
        provider: 'email',
        providers: ['email'],
        role: 'org_admin',
        organization_id: orgId
      },
      user_metadata: {
        full_name: adminFullName || null
      }
    })

    if (createErr || !createdData?.user) {
      return { error: 'Błąd tworzenia konta administratora: ' + (createErr?.message || 'Nieznany błąd') }
    }
    targetUserId = createdData.user.id
  }

  await supabase.from('audit_logs').insert({
    organization_id: orgId,
    action: 'ADMIN_INVITED',
    performed_by: callerUserId,
    payload: {
      admin_email: adminEmail,
      target_user_id: targetUserId,
      organization_name: orgName
    }
  })

  const inviteResult = await sendAdminInviteEmail(adminEmail, orgName)
  return {
    success: true,
    inviteUrl: inviteResult.inviteUrl,
    emailSent: inviteResult.emailSent
  }
}
