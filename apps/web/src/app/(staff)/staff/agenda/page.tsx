import { requireOrgFeature } from '@/lib/feature-flags'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import StaffAgendaScreen from './StaffAgendaScreen'

export default async function Page() {
  if (!(await requireOrgFeature('module_residents_management')).allowed) return <FeatureDisabledState />

  return <StaffAgendaScreen />
}
