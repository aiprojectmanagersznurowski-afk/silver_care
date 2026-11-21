import { FEATURE_FLAGS, resolveEffectiveFeatureFlags, type FeatureKey } from '@silvercare/contracts/src/generated/features'

export function featureSnapshot(overrides: Partial<Record<FeatureKey, boolean>> = {}) {
  const flags = resolveEffectiveFeatureFlags(overrides)
  return {
    data: FEATURE_FLAGS.map(({ key }) => ({ feature_key: key, enabled: flags[key] })),
    error: null,
  }
}
