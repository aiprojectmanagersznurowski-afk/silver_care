'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { validateOrganizationUpdate } from '@/lib/org-helpers'

async function sendAdminInviteEmail(adminEmail: string, orgName: string): Promise<{ inviteUrl: string | null; emailSent: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://silver-care-six.vercel.app'

    let { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: adminEmail,
      options: {
        redirectTo: `${siteUrl}/login`
      }
    })

    if (linkErr) {
      // Jeśli użytkownik jest już zarejestrowany w auth.users (np. utworzony w procedurze SQL), generujemy magiclink / recovery
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
        const emailRes = await fetch('https://send.api.mailtrap.io/api/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${emailProviderKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: [{ email: adminEmail }],
            from: { email: 'noreply@silvercare.space', name: 'Silver Care' },
            subject: `Zaproszenie do zarządzania placówką ${orgName} w Silver Care`,
            text: `Dzień dobry,\n\nZostałeś mianowany administratorem placówki „${orgName}” w systemie Silver Care.\n\nAby aktywować swoje konto i uzyskać dostęp do panelu zarządzania placówką, przejdź pod poniższy link:\n\n${inviteUrl}\n\nLink jest aktywny przez 7 dni.\n\nPozdrawiamy,\nZespół Silver Care`
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
  } catch (err: any) {
    console.error('[ADMIN_INVITE] Nieoczekiwany błąd zaproszenia:', err)
    return { inviteUrl: null, emailSent: false, error: err?.message || 'Błąd zaproszenia.' }
  }
}

export async function createOrganizationAction(formData: FormData) {
  const orgName = (formData.get('orgName') as string)?.trim()
  const address = (formData.get('address') as string)?.trim() || null
  const residentLimitRaw = formData.get('residentLimit') as string
  const adminEmail = (formData.get('adminEmail') as string)?.trim().toLowerCase()
  const adminFullName = (formData.get('adminFullName') as string)?.trim() || null

  if (!orgName) {
    return { error: 'Nazwa placówki jest wymagana.' }
  }

  if (!adminEmail) {
    return { error: 'Adres e-mail administratora jest wymagany.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(adminEmail)) {
    return { error: 'Podano nieprawidłowy adres e-mail administratora.' }
  }

  const residentLimit = residentLimitRaw && !isNaN(Number(residentLimitRaw))
    ? Math.max(1, parseInt(residentLimitRaw, 10))
    : 50

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const callerRole = user?.app_metadata?.role || user?.user_metadata?.role
  if (!user || callerRole !== 'super_admin') {
    return { error: 'Brak uprawnień. Wymagana rola super_admin.' }
  }

  try {
    const { data: orgId, error: rpcErr } = await supabase.rpc('provision_organization', {
      p_org_name: orgName,
      p_admin_email: adminEmail,
      p_address: address,
      p_resident_limit: residentLimit,
      p_admin_full_name: adminFullName
    })

    if (rpcErr) {
      console.error('Błąd provisioningu placówki:', rpcErr)
      return { error: 'Błąd tworzenia placówki: ' + rpcErr.message }
    }

    // Generujemy link aktywacyjny i wysyłamy e-mail z zaproszeniem
    const inviteResult = await sendAdminInviteEmail(adminEmail, orgName)

    revalidatePath('/admin/organizations')

    return {
      success: true,
      organizationId: orgId as string,
      orgName,
      adminEmail,
      inviteUrl: inviteResult.inviteUrl,
      emailSent: inviteResult.emailSent
    }
  } catch (err: unknown) {
    console.error('Nieoczekiwany błąd serwera:', err)
    return { error: err instanceof Error ? err.message : 'Wystąpił błąd serwera.' }
  }
}

export async function resendAdminInviteAction(formData: FormData) {
  const adminEmail = (formData.get('adminEmail') as string)?.trim().toLowerCase()
  const orgId = (formData.get('organizationId') as string)?.trim()
  const orgName = (formData.get('orgName') as string)?.trim() || 'placówce'

  if (!adminEmail) {
    return { error: 'Adres e-mail administratora jest wymagany.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const callerRole = user?.app_metadata?.role || user?.user_metadata?.role
  if (!user || callerRole !== 'super_admin') {
    return { error: 'Brak uprawnień. Wymagana rola super_admin.' }
  }

  try {
    const inviteResult = await sendAdminInviteEmail(adminEmail, orgName)

    if (orgId) {
      revalidatePath(`/admin/organizations/${orgId}`)
    }

    return {
      success: true,
      adminEmail,
      inviteUrl: inviteResult.inviteUrl,
      emailSent: inviteResult.emailSent
    }
  } catch (err: unknown) {
    console.error('Błąd ponownej wysyłki zaproszenia:', err)
    return { error: err instanceof Error ? err.message : 'Wystąpił błąd serwera.' }
  }
}

export async function addAdminToOrganizationAction(formData: FormData) {
  const orgId = (formData.get('organizationId') as string)?.trim()
  const orgName = (formData.get('orgName') as string)?.trim() || 'placówki'
  const adminEmail = (formData.get('adminEmail') as string)?.trim().toLowerCase()
  const adminFullName = (formData.get('adminFullName') as string)?.trim() || null

  if (!orgId) {
    return { error: 'Identyfikator placówki jest wymagany.' }
  }

  if (!adminEmail) {
    return { error: 'Adres e-mail administratora jest wymagany.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(adminEmail)) {
    return { error: 'Podano nieprawidłowy adres e-mail administratora.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const callerRole = user?.app_metadata?.role || user?.user_metadata?.role
  if (!user || callerRole !== 'super_admin') {
    return { error: 'Brak uprawnień. Wymagana rola super_admin.' }
  }

  try {
    const adminClient = createAdminClient()

    // Sprawdzamy czy użytkownik już istnieje
    const { data: listData } = await adminClient.auth.admin.listUsers()
    const existingUser = listData?.users?.find(u => u.email?.toLowerCase() === adminEmail)

    let targetUserId = existingUser?.id

    if (existingUser) {
      // Aktualizujemy metadane istniejącego użytkownika
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(existingUser.id, {
        app_metadata: {
          ...existingUser.app_metadata,
          role: 'org_admin',
          organization_id: orgId
        },
        user_metadata: {
          ...existingUser.user_metadata,
          role: 'org_admin',
          organization_id: orgId,
          ...(adminFullName ? { full_name: adminFullName } : {})
        }
      })
      if (updateErr) {
        return { error: 'Błąd przypisywania roli: ' + updateErr.message }
      }
    } else {
      // Tworzymy nowe konto z rolą org_admin
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
          role: 'org_admin',
          organization_id: orgId,
          full_name: adminFullName || null
        }
      })

      if (createErr || !createdData?.user) {
        return { error: 'Błąd tworzenia konta administratora: ' + (createErr?.message || 'Nieznany błąd') }
      }
      targetUserId = createdData.user.id
    }

    // Zapis do audit_logs
    await supabase.from('audit_logs').insert({
      organization_id: orgId,
      action: 'ADMIN_INVITED',
      performed_by: user.id,
      payload: {
        admin_email: adminEmail,
        target_user_id: targetUserId,
        organization_name: orgName
      }
    })

    // Wysyłka zaproszenia
    const inviteResult = await sendAdminInviteEmail(adminEmail, orgName)

    revalidatePath(`/admin/organizations/${orgId}`)

    return {
      success: true,
      adminEmail,
      inviteUrl: inviteResult.inviteUrl,
      emailSent: inviteResult.emailSent
    }
  } catch (err: unknown) {
    console.error('Błąd dodawania administratora do placówki:', err)
    return { error: err instanceof Error ? err.message : 'Wystąpił błąd serwera.' }
  }
}

export async function updateOrganizationAction(formData: FormData) {
  const orgId = (formData.get('organizationId') as string)?.trim()
  const orgName = (formData.get('orgName') as string)?.trim()
  const address = (formData.get('address') as string)?.trim() || null
  const residentLimitRaw = formData.get('residentLimit') as string

  if (!orgId) {
    return { error: 'Identyfikator placówki jest wymagany.' }
  }

  const validation = validateOrganizationUpdate({
    orgName,
    residentLimit: residentLimitRaw,
    address
  })

  if (!validation.valid || !validation.data) {
    return { error: validation.error || 'Nieprawidłowe dane formularza.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const callerRole = user?.app_metadata?.role || user?.user_metadata?.role
  if (!user || callerRole !== 'super_admin') {
    return { error: 'Brak uprawnień. Wymagana rola super_admin.' }
  }

  try {
    const { data: updatedOrg, error: updateErr } = await supabase
      .from('organizations')
      .update({
        name: validation.data.orgName,
        address: validation.data.address,
        resident_limit: validation.data.residentLimit
      })
      .eq('id', orgId)
      .select()
      .single()

    if (updateErr) {
      console.error('Błąd aktualizacji placówki:', updateErr)
      return { error: 'Błąd aktualizacji placówki: ' + updateErr.message }
    }

    // Rejestracja w audit_logs
    await supabase.from('audit_logs').insert({
      organization_id: orgId,
      action: 'ORGANIZATION_UPDATED',
      performed_by: user.id,
      payload: {
        organization_name: validation.data.orgName,
        address: validation.data.address,
        resident_limit: validation.data.residentLimit
      }
    })

    revalidatePath('/admin/organizations')
    revalidatePath(`/admin/organizations/${orgId}`)

    return {
      success: true,
      organization: updatedOrg
    }
  } catch (err: unknown) {
    console.error('Nieoczekiwany błąd serwera podczas aktualizacji placówki:', err)
    return { error: err instanceof Error ? err.message : 'Wystąpił błąd serwera.' }
  }
}
