import { createClient } from '@/lib/supabase/server'
import { isImpersonationSessionActive } from '@/lib/impersonation-guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

export interface StaffActionResult {
  success?: boolean
  error?: string
  message?: string
}

export type VerifyStaffManagerResult =
  | { success: false; error: string }
  | {
      success: true
      supabase: Awaited<ReturnType<typeof createClient>>
      adminClient: ReturnType<typeof createAdminClient>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callerUser: any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      targetUser: any
      targetOrg: string | null | undefined
    }

export async function verifyStaffManagerAndTarget(staffId: string): Promise<VerifyStaffManagerResult> {
  if (!staffId) {
    return { success: false, error: 'Brak identyfikatora pracownika.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Brak aktywnej sesji.' }
  }

  const cookieStore = await cookies()
  if (isImpersonationSessionActive(cookieStore, user)) {
    return { success: false, error: 'Akcje administracyjne są zablokowane w trybie impersonacji.' }
  }

  const callerRole = user.app_metadata?.role || user.user_metadata?.role
  const callerOrg = user.app_metadata?.organization_id || user.user_metadata?.organization_id

  if (callerRole !== 'org_admin' && callerRole !== 'super_admin' && callerRole !== 'admin') {
    return { success: false, error: 'Brak uprawnień do zarządzania kontami personelu.' }
  }

  const adminClient = createAdminClient()
  const { data: targetUser, error: fetchErr } = await adminClient.auth.admin.getUserById(staffId)

  if (fetchErr || !targetUser?.user) {
    return { success: false, error: 'Nie znaleziono wskazanego pracownika.' }
  }

  const targetOrg = targetUser.user.app_metadata?.organization_id || targetUser.user.user_metadata?.organization_id
  if (callerRole === 'org_admin' && targetOrg !== callerOrg) {
    return { success: false, error: '403: Nie masz uprawnień do pracownika z innej placówki.' }
  }

  return {
    success: true,
    supabase,
    adminClient,
    callerUser: user,
    targetUser: targetUser.user,
    targetOrg: targetOrg || callerOrg
  }
}

export async function logStaffAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  adminClient: ReturnType<typeof createAdminClient>,
  callerId: string,
  staffId: string,
  action: string,
  orgId: string | null | undefined
) {
  try {
    const { error } = orgId ? await supabase.rpc('log_staff_management_action', {
      p_target_user_id: staffId,
      p_action: action,
      p_organization_id: orgId
    }) : { error: new Error('No orgId') }
    if (error) {
      await adminClient.from('audit_logs').insert({
        organization_id: orgId || null,
        action,
        performed_by: callerId,
        payload: {
          target_user_id: staffId,
          timestamp: new Date().toISOString()
        }
      })
    }
  } catch {
    try {
      await adminClient.from('audit_logs').insert({
        organization_id: orgId || null,
        action,
        performed_by: callerId,
        payload: {
          target_user_id: staffId,
          timestamp: new Date().toISOString()
        }
      })
    } catch (auditErr) {
      console.error('Błąd rejestracji audytu personelu:', auditErr)
    }
  }
}
