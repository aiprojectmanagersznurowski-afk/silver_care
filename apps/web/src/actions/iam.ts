'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const VALID_ROLES = ['super_admin', 'org_admin', 'nurse', 'legal_guardian', 'family'] as const
type ValidRole = typeof VALID_ROLES[number]

function isValidRole(role: string): role is ValidRole {
  return (VALID_ROLES as readonly string[]).includes(role)
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

  // 2. Aktualizacja roli w Supabase Auth app_metadata
  const { error: updateErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
    app_metadata: {
      ...targetUser.user.app_metadata,
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
