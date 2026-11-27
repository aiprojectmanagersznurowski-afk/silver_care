import type { FeatureKey } from '@silvercare/contracts/src/generated/features'
import type { EffectiveFeatureFlags } from '@/lib/feature-flags'
import { categoriesToSearch, type SearchCategoryKey } from '@/lib/global-search-helpers'

const CATEGORY_FEATURE: Partial<Record<SearchCategoryKey, FeatureKey>> = {
  residents: 'module_residents_management',
  facility: 'module_facility_management',
  agenda: 'module_residents_management',
  reports: 'module_voice_and_reports',
}

export function availableSearchCategories(role: string | null | undefined, flags: EffectiveFeatureFlags | null) {
  return categoriesToSearch('all', role).filter((category) => {
    const feature = CATEGORY_FEATURE[category]
    return !feature || Boolean(flags?.[feature])
  })
}
