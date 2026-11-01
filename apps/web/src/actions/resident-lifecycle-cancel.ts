'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * Anulowanie omyłkowego zgłoszenia zgonu przez Kierownika placówki [ADM-RESIDENT-LIFECYCLE-DISCHARGE]
 */
export async function cancelDeathReportAction(residentId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Brak aktywnej sesji użytkownika.' }

  const role = user.app_metadata?.role as string | undefined
  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!role || !['org_admin', 'super_admin'].includes(role)) {
    return { success: false, error: 'Brak uprawnień do anulowania zgłoszenia (wymagana rola Kierownika placówki).' }
  }

  const adminClient = createAdminClient()
  const { data: resident } = await adminClient
    .from('residents')
    .select('id, organization_id, death_date, death_reported_at')
    .eq('id', residentId)
    .single()

  if (!resident) return { success: false, error: 'Nie znaleziono podopiecznego.' }
  if (role !== 'super_admin' && resident.organization_id !== orgId) {
    return { success: false, error: 'Brak uprawnień do zasobów innej placówki.' }
  }
  if (!resident.death_reported_at) {
    return { success: false, error: 'Ten podopieczny nie ma oczekującego zgłoszenia zgonu.' }
  }

  await adminClient.from('residents').update({ death_reported_at: null }).eq('id', residentId)
  await adminClient.from('agenda_items').delete().eq('resident_id', residentId).eq('type', 'staff_only')

  await adminClient.from('audit_logs').insert({
    organization_id: resident.organization_id,
    performed_by: user.id,
    action: 'RESIDENT_DEATH_REPORT_CANCELLED',
    payload: { target_table: 'residents', target_id: residentId },
  })

  for (const p of [`/staff/residents/${residentId}`, `/admin/residents/${residentId}`, '/admin']) {
    revalidatePath(p)
  }
  return { success: true }
}
