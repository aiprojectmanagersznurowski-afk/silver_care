import { redirect } from 'next/navigation'
import { OPERATIONAL_REPORT_ENGINE } from '@silvercare/contracts/src/generated/voice'
import { FeatureFlagsMfa } from '@/components/admin/FeatureFlagsMfa'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import { PageHeader } from '@/components/patterns/PageHeader'
import { TableCard, TableStateRow } from '@/components/patterns/TableCard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getAppOrganizationId, getAppRole } from '@/lib/auth/app-role'
import { requireOrgFeature } from '@/lib/feature-flags'
import { formatPersonName } from '@/lib/person-name'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { createClient } from '@/lib/supabase/server'
import { staffMfaSatisfied } from '@/lib/auth/staff-mfa'
import { VoiceFactDecision } from './VoiceFactDecision'

export const dynamic = 'force-dynamic'

const time = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Warsaw' })

export default async function VoiceFamilyFactsPage() {
  const user = await getCurrentUser()
  const orgId = getAppOrganizationId(user)
  const role = getAppRole(user)
  if (!orgId || (role !== 'org_admin' && role !== 'nurse')) redirect('/staff')
  if (!(await requireOrgFeature(OPERATIONAL_REPORT_ENGINE.moduleKey)).allowed) return <FeatureDisabledState />
  const header = <PageHeader title="Fakty do raportów rodzinnych"
    description="Uwzględnione fakty z nagrań trafiają do szkicu dobowego podopiecznego."
    back={{ href: '/staff/reports', label: 'Wróć do raportów' }} />
  const supabase = await createClient()
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (!await staffMfaSatisfied(supabase, assurance?.currentLevel)) {
    return <div className="space-y-4">{header}<FeatureFlagsMfa needsVerification={assurance?.nextLevel === 'aal2'}
      description="Potwierdź drugi składnik uwierzytelniania, aby sprawdzić fakty do raportów." /></div>
  }

  const result = await supabase.from(OPERATIONAL_REPORT_ENGINE.proposalsResource)
    .select('segment_id, recorded_at, time_state, behavioral_facts, residents!inner(first_name,last_name,archived_at)')
    .eq('organization_id', orgId).not('resident_id', 'is', null).is('family_decision', null)
    .filter('behavioral_facts', 'neq', '{}').is('residents.archived_at', null).order('recorded_at').limit(100)
  return (
    <div className="space-y-6">
      {header}
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Podopieczny</TableHead><TableHead>Czas nagrania</TableHead>
              <TableHead>Fakty</TableHead><TableHead>Decyzja</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {result.error && <TableStateRow colSpan={4} state="error" title="Nie udało się pobrać faktów" />}
            {!result.error && !result.data?.length && <TableStateRow colSpan={4} state="empty" title="Brak faktów do sprawdzenia" />}
            {result.data?.map((row) => (
              <TableRow key={row.segment_id}>
                <TableCell>{formatPersonName(row.residents?.first_name, row.residents?.last_name)}</TableCell>
                <TableCell>{row.time_state === 'UNKNOWN' ? 'Do ustalenia' : time.format(new Date(row.recorded_at))}</TableCell>
                <TableCell className="whitespace-pre-wrap">{row.behavioral_facts.join('\n')}</TableCell>
                <TableCell><VoiceFactDecision segmentId={row.segment_id} canInclude={row.time_state !== 'UNKNOWN'} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  )
}
