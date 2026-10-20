'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  isValidRole,
  safeRevalidateIam,
  verifySuperAdminCaller,
  executeUserCreation,
  executeUserStatusChange,
  UserStatusMode
} from '@/lib/iam-actions-helpers'

export async function updateUserRoleAction(formData: FormData) {
  const targetUserId = formData.get('userId') as string
  const newRole = formData.get('role') as string

  if (!targetUserId || !newRole) {
    return { error: 'Brak wymaganych parametrów' }
  }

  // AC3: Serwerowa blokada eskalacji uprawnień do roli super_admin
  if (newRole === 'super_admin') {
    return { error: 'Brak uprawnień: nadawanie roli super_admin jest zablokowane.', status: 403, code: 403 }
  }

  if (!isValidRole(newRole)) {
    return { error: 'Nieprawidłowa rola' }
  }

  const { error: authErr, supabase } = await verifySuperAdminCaller()
  if (authErr) {
    return { error: authErr, status: 403, code: 403 }
  }

  const adminClient = createAdminClient()
  const { data: targetUser, error: fetchErr } = await adminClient.auth.admin.getUserById(targetUserId)

  if (fetchErr || !targetUser?.user) {
    return { error: 'Nie znaleziono wskazanego użytkownika' }
  }

  const prevRole = targetUser.user.app_metadata?.role || 'brak'
  const orgId = targetUser.user.app_metadata?.organization_id || null

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

  safeRevalidateIam()
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

  if (role === 'super_admin') {
    return { error: 'Brak uprawnień: tworzenie konta z rolą super_admin jest zablokowane.', status: 403, code: 403 }
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

  const { error: authErr, supabase } = await verifySuperAdminCaller()
  if (authErr) {
    return { error: authErr, status: 403, code: 403 }
  }

  const adminClient = createAdminClient()
  const res = await executeUserCreation(supabase, adminClient, {
    email,
    role,
    passwordInput,
    organizationIdInput
  })

  if (res.error) {
    return { error: res.error }
  }

  safeRevalidateIam()
  return { success: true, user: res.user }
}

export async function resetUserPasswordAction(formData: FormData) {
  const targetUserId = (formData.get('userId') as string)?.trim()

  if (!targetUserId) {
    return { error: 'Brak identyfikatora użytkownika.' }
  }

  const { error: authErr, supabase } = await verifySuperAdminCaller()
  if (authErr) {
    return { error: authErr, status: 403, code: 403 }
  }

  const adminClient = createAdminClient()
  const { data: targetUserData, error: fetchErr } = await adminClient.auth.admin.getUserById(targetUserId)

  if (fetchErr || !targetUserData?.user || !targetUserData.user.email) {
    return { error: 'Nie znaleziono wskazanego użytkownika lub brak adresu email.' }
  }

  const targetEmail = targetUserData.user.email
  const orgId = targetUserData.user.app_metadata?.organization_id || null

  const { error: rpcErr } = await supabase.rpc('log_password_reset', {
    p_target_user_id: targetUserId,
    p_organization_id: orgId
  })

  if (rpcErr) {
    console.error('Błąd audytu przy resecie hasła:', rpcErr)
  }

  const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail)

  if (resetErr) {
    console.error('Błąd wysyłania linku resetującego przez Supabase:', resetErr)
    return { error: 'Błąd wysyłania linku resetującego: ' + resetErr.message }
  }

  safeRevalidateIam()

  return {
    success: true,
    userId: targetUserId,
    email: targetEmail,
    recoveryEmailSent: true
  }
}

export async function manageUserStatusAction(formData: FormData) {
  const targetUserId = (formData.get('userId') as string)?.trim()
  const mode = (formData.get('mode') as string)?.trim() as UserStatusMode

  if (!targetUserId || !mode) {
    return { error: 'Brak wymaganych parametrów (userId, mode).' }
  }

  if (mode !== 'deactivate' && mode !== 'activate' && mode !== 'hard_delete') {
    return { error: 'Nieprawidłowy tryb operacji.' }
  }

  const { error: authErr, user } = await verifySuperAdminCaller()
  if (authErr || !user) {
    return { error: authErr || 'Brak uprawnień.', status: 403, code: 403 }
  }

  if (targetUserId === user.id) {
    return {
      error: 'Nie możesz usunąć ani zablokować własnego konta administratora.',
      status: 403,
      code: 403
    }
  }

  const adminClient = createAdminClient()
  const { data: targetUserData, error: fetchErr } = await adminClient.auth.admin.getUserById(targetUserId)

  if (fetchErr || !targetUserData?.user) {
    return { error: 'Nie znaleziono wskazanego użytkownika.' }
  }

  const res = await executeUserStatusChange(adminClient, targetUserData.user, targetUserId, user.id, mode)
  if (res.error) {
    return { error: res.error }
  }

  safeRevalidateIam()

  return {
    success: true,
    userId: targetUserId,
    mode
  }
}
