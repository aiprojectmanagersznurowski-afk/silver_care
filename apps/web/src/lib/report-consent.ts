import type { CONSENT_PURPOSES } from '@silvercare/contracts/src/generated/roles'
import type { createAdminClient } from '@/lib/supabase/admin'

const reportPurpose: (typeof CONSENT_PURPOSES)[number]['id'] = 'family_report_access'

export async function canNotifyFamilyOfReport(
  admin: Pick<ReturnType<typeof createAdminClient>, 'from'>,
  organizationId: string,
  residentId: string,
) {
  const { data, error } = await admin.from('consent_ledger').select('revoked_at')
    .eq('organization_id', organizationId).eq('resident_id', residentId).eq('purpose', reportPurpose)
    .order('granted_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error('REPORT_CONSENT_UNAVAILABLE')
  return data?.revoked_at === null
}
