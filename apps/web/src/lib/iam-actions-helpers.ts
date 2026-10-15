import { revalidatePath } from 'next/cache'
import { ROLES } from '@silvercare/contracts/src/generated/roles'
import { createClient } from '@/lib/supabase/server'
import { isImpersonationSessionActive, safeGetCookieStore } from '@/lib/impersonation-guards'
import { generateSecureTemporaryPassword } from '@/lib/staff-helpers'

export type UserStatusMode = 'deactivate' | 'activate' | 'hard_delete'
export type ValidRole = typeof ROLES[number]['id']

export function isValidRole(role: string): role is ValidRole {
  return ROLES.some(r => r.id === role)
}

export function safeRevalidateIam() {
  try {
    revalidatePath('/admin/iam')
  } catch {
    // Bezpieczne wyciszenie poza kontekstem serwera Next.js (np. w testach)
  }
}

export async function verifySuperAdminCaller(options?: { allowImpersonation?: boolean }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const callerRole = user?.app_metadata?.role || user?.user_metadata?.role
  if (!user || callerRole !== 'super_admin') {
    return { error: 'Brak uprawnień. Wymagana rola super_admin.', status: 403, code: 403, user: null, supabase }
  }

  if (!options?.allowImpersonation) {
    const cookieStore = await safeGetCookieStore()
    if (isImpersonationSessionActive(cookieStore, user)) {
      return {
        error: 'Operacja niedozwolona w trybie podglądu (impersonacji). Tryb jest ściśle Read-Only.',
        status: 403,
        code: 403,
        user: null,
        supabase
      }
    }
  }

  return { error: null, user, supabase }
}

export async function executeUserCreation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  params: {
    email: string
    role: string
    passwordInput?: string
    organizationIdInput?: string
  }
) {
  const { email, role, passwordInput, organizationIdInput } = params
  const password = passwordInput && passwordInput.length >= 6
    ? passwordInput
    : generateSecureTemporaryPassword(16)

  const organizationId = organizationIdInput && organizationIdInput.length > 0
    ? organizationIdInput
    : null

  const { data: createdData, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { email_verified: true },
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

  const { error: rpcErr } = await supabase.rpc('log_role_change', {
    p_target_user_id: newUser.id,
    p_new_role: role,
    p_previous_role: null,
    p_organization_id: organizationId
  })

  if (rpcErr) {
    console.error('Błąd audytu przy tworzeniu użytkownika:', rpcErr)
  }

  return {
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

export async function executeUserStatusChange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  targetUser: any,
  targetUserId: string,
  callerUserId: string,
  mode: UserStatusMode
) {
  const targetOrgId = targetUser.app_metadata?.organization_id || null
  const targetRole = targetUser.app_metadata?.role || 'brak'

  if (mode === 'deactivate') {
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: '87600h',
      app_metadata: {
        ...targetUser.app_metadata,
        is_active: false
      }
    })
    if (updateErr) return { error: 'Błąd deaktywacji konta: ' + updateErr.message }

    const { error: auditErr } = await adminClient.from('audit_logs').insert({
      organization_id: targetOrgId,
      action: 'USER_DEACTIVATED',
      performed_by: callerUserId,
      payload: { target_user_id: targetUserId, previous_role: targetRole, mode: 'deactivate' }
    })
    if (auditErr) console.error('Błąd audytu deaktywacji użytkownika:', auditErr)
  } else if (mode === 'activate') {
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: 'none',
      app_metadata: {
        ...targetUser.app_metadata,
        is_active: true
      }
    })
    if (updateErr) return { error: 'Błąd aktywacji konta: ' + updateErr.message }

    const { error: auditErr } = await adminClient.from('audit_logs').insert({
      organization_id: targetOrgId,
      action: 'USER_ACTIVATED',
      performed_by: callerUserId,
      payload: { target_user_id: targetUserId, role: targetRole, mode: 'activate' }
    })
    if (auditErr) console.error('Błąd audytu aktywacji użytkownika:', auditErr)
  } else if (mode === 'hard_delete') {
    const { error: auditErr } = await adminClient.from('audit_logs').insert({
      organization_id: targetOrgId,
      action: 'USER_HARD_DELETED',
      performed_by: callerUserId,
      payload: { target_user_id: targetUserId, previous_role: targetRole, mode: 'hard_delete' }
    })
    if (auditErr) console.error('Błąd audytu usunięcia użytkownika:', auditErr)

    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(targetUserId)
    if (deleteErr) return { error: 'Błąd usuwania użytkownika: ' + deleteErr.message }
  }

  return { success: true }
}
