'use server'

import { featureDisabledMessage, isOrgFeatureEnabled } from '@/lib/feature-flags'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { isImpersonationSessionActive, assertMutationAllowedDuringImpersonation } from '@/lib/impersonation-guards'
import { FUNDING_SOURCES, type FundingSource } from '@/lib/reporting-constants'

export interface UpdateResidentFundingResult {
  success: boolean
  error?: string
}

const LOG_TAG = '[zrodlo-finansowania]'
const isFundingSource = (value: string): value is FundingSource => (FUNDING_SOURCES as readonly string[]).includes(value)

/**
 * Zapis źródła finansowania pobytu (SC-ADM-24, @REQ: ADM-RESIDENT-FUNDING).
 * Wyłącznie kierownik placówki (rola z app_metadata). Zapis klientem sesji — RLS resident_funding
 * sprawdza rolę i przynależność podopiecznego do placówki. Audyt bez danych osobowych; w logu tylko kody.
 */
export async function updateResidentFundingAction(
  residentId: string,
  fundingSource: string
): Promise<UpdateResidentFundingResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Brak aktywnej sesji użytkownika.' }

  const cookieStore = await cookies()
  const guard = assertMutationAllowedDuringImpersonation(isImpersonationSessionActive(cookieStore, user))
  if (!guard.allowed) return { success: false, error: guard.error }

  const orgId = user.app_metadata?.organization_id as string | undefined
  if (user.app_metadata?.role !== 'org_admin' || !orgId) {
    return { success: false, error: 'Źródło finansowania zmienia wyłącznie kierownik placówki.' }
  }
  if (!(await isOrgFeatureEnabled(supabase, orgId, 'module_residents_management'))) {
    return { success: false, error: featureDisabledMessage }
  }

  if (!residentId) return { success: false, error: 'Brak identyfikatora podopiecznego.' }
  if (!isFundingSource(fundingSource)) return { success: false, error: 'Wybierz źródło finansowania z listy.' }

  const previous = await supabase.from('resident_funding').select('funding_source').eq('resident_id', residentId).maybeSingle()
  if (previous.error) {
    console.error(LOG_TAG, 'odczyt nieudany', { code: previous.error.code })
    return { success: false, error: 'Nie udało się zapisać źródła finansowania.' }
  }

  const { error: upsertError } = await supabase.from('resident_funding').upsert(
    { resident_id: residentId, organization_id: orgId, funding_source: fundingSource, updated_by: user.id, updated_at: new Date().toISOString() },
    { onConflict: 'resident_id' }
  )
  if (upsertError) {
    console.error(LOG_TAG, 'zapis nieudany', { code: upsertError.code })
    return { success: false, error: 'Nie udało się zapisać źródła finansowania.' }
  }

  const { error: auditError } = await createAdminClient().from('audit_logs').insert({
    organization_id: orgId,
    performed_by: user.id,
    action: 'RESIDENT_FUNDING_CHANGED',
    payload: {
      target_table: 'resident_funding',
      target_id: residentId,
      from: (previous.data as { funding_source?: string } | null)?.funding_source ?? null,
      to: fundingSource,
    },
  })
  if (auditError) {
    // Zapis jest idempotentny: ponowienie powtórzy też wpis audytu
    console.error(LOG_TAG, 'audyt nieudany', { code: auditError.code })
    return { success: false, error: 'Nie udało się zapisać śladu zmiany. Spróbuj ponownie.' }
  }

  revalidatePath(`/admin/residents/${residentId}`)
  return { success: true }
}
