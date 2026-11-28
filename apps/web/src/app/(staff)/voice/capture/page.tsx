import { notFound, redirect } from 'next/navigation'
import { OPERATIONAL_REPORT_ENGINE } from '@silvercare/contracts/src/generated/voice'
import { FeatureFlagsMfa } from '@/components/admin/FeatureFlagsMfa'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import { PageHeader } from '@/components/patterns/PageHeader'
import { getAppOrganizationId, getAppRole } from '@/lib/auth/app-role'
import { staffMfaSatisfied } from '@/lib/auth/staff-mfa'
import { requireOrgFeature } from '@/lib/feature-flags'
import { formatPersonName } from '@/lib/person-name'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { VoiceCaptureRecorder } from '../VoiceCaptureRecorder'

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export default async function ResidentCapturePage({ searchParams }: {
  searchParams: Promise<{ resident?: string | string[] }>
}) {
  const user = await getCurrentUser()
  const role = getAppRole(user)
  const orgId = getAppOrganizationId(user)
  if (!user || !orgId || (role !== 'nurse' && role !== 'org_admin')) redirect('/staff')
  if (!(await requireOrgFeature(OPERATIONAL_REPORT_ENGINE.moduleKey)).allowed) return <FeatureDisabledState />
  const { resident } = await searchParams
  if (typeof resident !== 'string' || !uuid.test(resident)) notFound()

  const supabase = await createClient()
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (!await staffMfaSatisfied(supabase, assurance?.currentLevel)) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader title="Notatka głosowa" />
        <FeatureFlagsMfa needsVerification={assurance?.nextLevel === 'aal2'}
          description="Potwierdź drugi składnik uwierzytelniania, aby nagrać notatkę." />
      </div>
    )
  }

  const { data: person } = await supabase.from('residents').select('id, first_name, last_name')
    .eq('organization_id', orgId).eq('id', resident).is('archived_at', null).maybeSingle()
  if (!person) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Notatka głosowa"
        description={formatPersonName(person.first_name, person.last_name)}
        back={{
          href: `${role === 'org_admin' ? '/admin/residents' : '/staff/residents'}/${person.id}`,
          label: 'Wróć do karty podopiecznego',
        }}
      />
      <VoiceCaptureRecorder key={person.id} residentId={person.id} authorId={user.id} />
    </div>
  )
}
