'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { isImpersonationSessionActive, assertMutationAllowedDuringImpersonation } from '@/lib/impersonation-guards'

/**
 * Anulowanie omyłkowego zgłoszenia zgonu przez Kierownika placówki [ADM-RESIDENT-LIFECYCLE-DISCHARGE]
 */
export async function cancelDeathReportAction(residentId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Brak aktywnej sesji użytkownika.' }

  const cookieStore = await cookies()
  const guard = assertMutationAllowedDuringImpersonation(isImpersonationSessionActive(cookieStore, user))
  if (!guard.allowed) return { success: false, error: guard.error }

  const role = user.app_metadata?.role as string | undefined
  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!role || !['org_admin', 'super_admin'].includes(role)) {
    return { success: false, error: 'Brak uprawnień do anulowania zgłoszenia (wymagana rola Kierownika placówki).' }
  }

  const adminClient = createAdminClient()
  const { data: resident, error: fetchErr } = await adminClient
    .from('residents')
    .select('id, organization_id, death_date, death_reported_at')
    .eq('id', residentId)
    .single()

  if (fetchErr || !resident) return { success: false, error: 'Nie znaleziono podopiecznego.' }
  if (role !== 'super_admin' && resident.organization_id !== orgId) {
    return { success: false, error: 'Brak uprawnień do zasobów innej placówki.' }
  }
  if (!resident.death_reported_at) {
    return { success: false, error: 'Ten podopieczny nie ma oczekującego zgłoszenia zgonu.' }
  }

  const { error: updateErr } = await adminClient
    .from('residents')
    .update({ death_reported_at: null })
    .eq('id', residentId)
  if (updateErr) return { success: false, error: `Błąd podczas anulowania: ${updateErr.message}` }

  const { error: deleteErr } = await adminClient
    .from('agenda_items')
    .delete()
    .eq('resident_id', residentId)
    .eq('type', 'staff_only')
  if (deleteErr) return { success: false, error: `Błąd podczas usuwania zadań: ${deleteErr.message}` }

  const { error: eventErr } = await adminClient.from('resident_events').insert({
    organization_id: resident.organization_id,
    resident_id: residentId,
    event_type: 'death_reported_cancelled',
    event_date: new Date().toISOString().slice(0, 10),
    event_reason: 'death_reported_cancelled',
    performed_by: user.id,
  })
  if (eventErr) {
    console.error('[cancelDeathReportAction] Błąd zapisu zdarzenia anulowania:', eventErr.message)
  }

  const { error: auditErr } = await adminClient.from('audit_logs').insert({
    organization_id: resident.organization_id,
    performed_by: user.id,
    action: 'RESIDENT_DEATH_REPORT_CANCELLED',
    payload: { target_table: 'residents', target_id: residentId },
  })
  if (auditErr) {
    console.error('[cancelDeathReportAction] Błąd audytu:', auditErr.message)
  }

  for (const p of [`/staff/residents/${residentId}`, `/admin/residents/${residentId}`, '/admin']) {
    revalidatePath(p)
  }
  return { success: true }
}
