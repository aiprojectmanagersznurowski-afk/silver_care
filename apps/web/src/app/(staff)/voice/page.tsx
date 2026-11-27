import { requireOrgFeature } from '@/lib/feature-flags'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import VoiceNoteScreen from './VoiceNoteScreen'

export default async function Page() {
  if (!(await requireOrgFeature('module_voice_and_reports')).allowed) return <FeatureDisabledState />

  return <VoiceNoteScreen />
}
