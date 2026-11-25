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

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export async function recordResidentConsent(_previous: ConsentResult, formData: FormData): Promise<ConsentResult> {
  const resident = formData.get('resident')
  const purpose = formData.get('purpose')
  const grantorSelection = formData.get('grantor')
  const grantorAccount = typeof grantorSelection === 'string' && uuid.test(grantorSelection) ? grantorSelection : null
  const grantor = grantorAccount ? 'legal_guardian' : grantorSelection
  if (typeof resident !== 'string' || !uuid.test(resident)
    || typeof purpose !== 'string' || !CONSENT_PURPOSES.some(({ id }) => id === purpose)
    || typeof grantor !== 'string' || !CONSENT_GRANTORS.some((id) => id === grantor)
    || (grantor === 'legal_guardian' && !grantorAccount)
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
    organization_id: orgId, resident_id: resident, purpose, granted_by: grantor, grantor_user_id: grantorAccount,
  })
  if (error?.message === 'CONSENT_GRANTOR_UNVERIFIED') {
    return { saved: false, message: 'Wybierz konto opiekuna prawnego powiązane z podopiecznym.' }
  }
  if (error) return { saved: false, message: 'Nie udało się potwierdzić zapisu zgody.' }
  revalidatePath('/admin/residents/' + resident)
  return { saved: true, message: 'Zapisano zgodę na wybrany cel.' }
}
