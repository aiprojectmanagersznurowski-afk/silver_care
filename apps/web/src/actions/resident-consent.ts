'use server'

import { CONSENT_GRANTORS, CONSENT_PURPOSES } from '@silvercare/contracts/src/generated/roles'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { staffMfaSatisfied } from '@/lib/auth/staff-mfa'
import { isImpersonationSessionActive, safeGetCookieStore } from '@/lib/impersonation-guards'

interface ConsentResult {
  message: string
  saved: boolean
}

export async function recordResidentConsent(_previous: ConsentResult, formData: FormData): Promise<ConsentResult> {
  const resident = formData.get('resident')
  const purpose = formData.get('purpose')
  const grantor = formData.get('grantor')
  if (typeof resident !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(resident)
    || typeof purpose !== 'string' || !CONSENT_PURPOSES.some(({ id }) => id === purpose)
    || typeof grantor !== 'string' || !CONSENT_GRANTORS.some((id) => id === grantor)
    || formData.get('confirmed') !== 'on') {
    return { saved: false, message: 'Sprawdź cel i potwierdź udokumentowaną zgodę.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = user?.app_metadata?.organization_id
  if (!user || !orgId || user.app_metadata?.role !== 'org_admin'
    || isImpersonationSessionActive(await safeGetCookieStore(), user)) {
    return { saved: false, message: 'Zgodę zapisuje kierownik właściwej placówki.' }
  }
  const { data } = await supabase.auth.getClaims()
  if (data?.claims.sub !== user.id || !await staffMfaSatisfied(supabase, data.claims.aal)) {
    return { saved: false, message: 'Potwierdź drugi składnik uwierzytelniania.' }
  }

  const { error } = await supabase.from('consent_ledger').insert({
    organization_id: orgId, resident_id: resident, purpose, granted_by: grantor,
  })
  if (error) return { saved: false, message: 'Nie udało się potwierdzić zapisu zgody.' }
  revalidatePath('/admin/residents/' + resident)
  return { saved: true, message: 'Zapisano zgodę na wybrany cel.' }
}
