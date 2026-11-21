import { requireOrgFeature } from '@/lib/feature-flags'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import FacilityManagementScreen from './FacilityManagementScreen'

export default async function Page() {
  if (!(await requireOrgFeature('module_facility_management')).allowed) return <FeatureDisabledState />

  return <FacilityManagementScreen />
}
