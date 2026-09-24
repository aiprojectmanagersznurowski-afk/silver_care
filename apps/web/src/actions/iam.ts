'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateSecureTemporaryPassword } from '@/lib/staff-helpers'
import { revalidatePath } from 'next/cache'

import { ROLES } from '@silvercare/contracts/src/generated/roles'

type ValidRole = typeof ROLES[number]['id']

function isValidRole(role: string): role is ValidRole {
  return ROLES.some(r => r.id === role)
}

export async function updateUserRoleAction(formData: FormData) {
  const targetUserId = formData.get('userId') as string
  const newRole = formData.get('role') as string

  if (!targetUserId || !newRole) {
    return { error: 'Brak wymaganych parametrów' }
  }

  if (!isValidRole(newRole)) {
    return { error: 'Nieprawidłowa rola' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const callerRole = user?.app_metadata?.role || user?.user_metadata?.role
  if (!user || callerRole !== 'super_admin') {
    return { error: 'Brak uprawnień. Wymagana rola super_admin.' }
  }

  const adminClient = createAdminClient()
  const { data: targetUser, error: fetchErr } = await adminClient.auth.admin.getUserById(targetUserId)

  if (fetchErr || !targetUser?.user) {
    return { error: 'Nie znaleziono wskazanego użytkownika' }
  }

  const prevRole = targetUser.user.app_metadata?.role || 'brak'
  const orgId = targetUser.user.app_metadata?.organization_id || null

  // 1. Rejestracja w audit_logs przez RPC log_role_change
  const { error: rpcErr } = await supabase.rpc('log_role_change', {
    p_target_user_id: targetUserId,
    p_new_role: newRole,
    p_previous_role: prevRole,
    p_organization_id: orgId
  })

  if (rpcErr) {
    console.error('Błąd rejestracji audytu zmiany roli:', rpcErr)
    return { error: 'Błąd audytu: ' + rpcErr.message }
  }

  // 2. Aktualizacja roli w Supabase Auth app_metadata oraz user_metadata
  const { error: updateErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
    app_metadata: {
      ...targetUser.user.app_metadata,
      role: newRole
    },
    user_metadata: {
      ...targetUser.user.user_metadata,
      role: newRole
    }
  })

  if (updateErr) {
    console.error('Błąd aktualizacji roli:', updateErr)
    return { error: 'Błąd aktualizacji użytkownika: ' + updateErr.message }
  }

  revalidatePath('/admin/iam')
  return { success: true }
}

export async function createUserWithRoleAction(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const role = (formData.get('role') as string)?.trim()
  const passwordInput = (formData.get('password') as string)?.trim()
  const organizationIdInput = (formData.get('organizationId') as string)?.trim()

  if (!email || !role) {
    return { error: 'E-mail oraz rola są polami wymaganymi.' }
  }

  if (!isValidRole(role)) {
    return { error: 'Nieprawidłowa rola użytkownika.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { error: 'Podano nieprawidłowy adres e-mail.' }
  }

  if (passwordInput && passwordInput.length < 6) {
    return { error: 'Podane hasło jest za krótkie (wymagane minimum 6 znaków).' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const callerRole = user?.app_metadata?.role || user?.user_metadata?.role
  if (!user || callerRole !== 'super_admin') {
    return { error: 'Brak uprawnień. Wymagana rola super_admin.' }
  }

  // Użyj podanego hasła (min 6 znaków) lub wygeneruj bezpieczne losowe
  const password = passwordInput && passwordInput.length >= 6
    ? passwordInput
    : generateSecureTemporaryPassword(16)

  const organizationId = organizationIdInput && organizationIdInput.length > 0
    ? organizationIdInput
    : null

  const adminClient = createAdminClient()
  const { data: createdData, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      email_verified: true
    },
    app_metadata: {
      provider: 'email',
      providers: ['email'],
      role,
      ...(organizationId ? { organization_id: organizationId } : {})
    }
  })

  if (createErr || !createdData?.user) {
    console.error('Błąd tworzenia użytkownika:', createErr)
    return { error: 'Błąd tworzenia użytkownika: ' + (createErr?.message || 'Nieznany błąd') }
  }

  const newUser = createdData.user

  // Rejestracja w audit_logs przez RPC log_role_change (previous_role = null)
  const { error: rpcErr } = await supabase.rpc('log_role_change', {
    p_target_user_id: newUser.id,
    p_new_role: role,
    p_previous_role: null,
    p_organization_id: organizationId
  })

  if (rpcErr) {
    console.error('Błąd audytu przy tworzeniu użytkownika:', rpcErr)
  }

  revalidatePath('/admin/iam')

  return {
    success: true,
    user: {
      id: newUser.id,
      email: newUser.email || email,
      role,
      organizationId,
      lastSignInAt: null,
      temporaryPassword: password
    }
  }
}

export async function resetUserPasswordAction(formData: FormData) {
  const targetUserId = (formData.get('userId') as string)?.trim()
  const passwordInput = (formData.get('password') as string)?.trim()

  if (!targetUserId) {
    return { error: 'Brak identyfikatora użytkownika.' }
  }

  if (passwordInput && passwordInput.length < 6) {
    return { error: 'Nowe hasło musi mieć co najmniej 6 znaków.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const callerRole = user?.app_metadata?.role || user?.user_metadata?.role
  if (!user || callerRole !== 'super_admin') {
    return { error: 'Brak uprawnień. Wymagana rola super_admin.' }
  }

  const adminClient = createAdminClient()
  const { data: targetUserData, error: fetchErr } = await adminClient.auth.admin.getUserById(targetUserId)

  if (fetchErr || !targetUserData?.user) {
    return { error: 'Nie znaleziono wskazanego użytkownika.' }
  }

  const newPassword = passwordInput && passwordInput.length >= 6
    ? passwordInput
    : generateSecureTemporaryPassword(16)

  const orgId = targetUserData.user.app_metadata?.organization_id || null

  // 1. Rejestracja w audit_logs przez RPC log_password_reset (brak haseł ani PII w audycie)
  const { error: rpcErr } = await supabase.rpc('log_password_reset', {
    p_target_user_id: targetUserId,
    p_organization_id: orgId
  })

  if (rpcErr) {
    console.error('Błąd audytu przy resecie hasła:', rpcErr)
  }

  // 2. Aktualizacja hasła użytkownika
  const { error: updateErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
    password: newPassword,
    email_confirm: true,
    user_metadata: {
      ...targetUserData.user.user_metadata,
      email_verified: true
    }
  })

  if (updateErr) {
    console.error('Błąd aktualizacji hasła:', updateErr)
    return { error: 'Błąd resetu hasła: ' + updateErr.message }
  }

  revalidatePath('/admin/iam')

  return {
    success: true,
    userId: targetUserId,
    email: targetUserData.user.email,
    newPassword
  }
}


