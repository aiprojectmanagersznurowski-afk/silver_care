import { redirect } from 'next/navigation'
import { OPERATIONAL_REPORT_ENGINE } from '@silvercare/contracts/src/generated/voice'
import { FeatureFlagsMfa } from '@/components/admin/FeatureFlagsMfa'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import { PageHeader } from '@/components/patterns/PageHeader'
import { getAppRole } from '@/lib/auth/app-role'
import { requireOrgFeature } from '@/lib/feature-flags'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { GeneralVoiceRecorder } from './GeneralVoiceRecorder'

export default async function GeneralVoicePage() {
  const user = await getCurrentUser()
  const role = getAppRole(user)
  if (!user || (role !== 'nurse' && role !== 'org_admin')) redirect('/staff')
  if (!(await requireOrgFeature(OPERATIONAL_REPORT_ENGINE.moduleKey)).allowed) return <FeatureDisabledState />
  const supabase = await createClient()
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Nagranie ogólne" back={{ href: '/voice', label: 'Wróć do trybów nagrywania' }} />
      {assurance?.currentLevel !== 'aal2' && (
        <FeatureFlagsMfa needsVerification={assurance?.nextLevel === 'aal2'}
          description="Potwierdź drugi składnik uwierzytelniania, aby przesłać nagrania." />
      )}
      <GeneralVoiceRecorder authorId={user.id} />
    </div>
  )
}
