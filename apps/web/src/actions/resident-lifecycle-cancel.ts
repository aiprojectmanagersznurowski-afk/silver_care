'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { isImpersonationSessionActive, assertMutationAllowedDuringImpersonation } from '@/lib/impersonation-guards'

/**
 * Atomowe anulowanie omyłkowego zgłoszenia zgonu przez Kierownika placówki [ADM-RESIDENT-LIFECYCLE-DISCHARGE]
 * Usuwa wpis w resident_death_reports oraz wyłącznie zadania procedury po zgonie powiązane ze zgłoszeniem,
 * zapisując zdarzenie death_reported_cancelled i ślad RESIDENT_DEATH_REPORT_CANCELLED w jednej transakcji.
 */
export async function cancelDeathReportAction(residentId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Brak aktywnej sesji użytkownika.' }

  const cookieStore = await cookies()
  const guard = assertMutationAllowedDuringImpersonation(isImpersonationSessionActive(cookieStore, user))
  if (!guard.allowed) return { success: false, error: guard.error }

  const role = user.app_metadata?.role as string | undefined
  if (!role || !['org_admin', 'super_admin'].includes(role)) {
    return { success: false, error: 'Brak uprawnień do anulowania zgłoszenia (wymagana rola Kierownika placówki).' }
  }

  const { error: rpcErr } = await supabase.rpc('cancel_resident_death_report_atomic', {
    p_resident_id: residentId,
  })
  if (rpcErr) {
    if (rpcErr.message.includes('DEATH_REPORT_NOT_PENDING')) {
      return { success: false, error: 'Ten podopieczny nie ma oczekującego zgłoszenia zgonu.' }
    }
    return { success: false, error: `Błąd podczas anulowania zgłoszenia: ${rpcErr.message}` }
  }

  for (const p of [`/staff/residents/${residentId}`, `/admin/residents/${residentId}`, '/admin']) {
    revalidatePath(p)
  }
  return { success: true }
}
