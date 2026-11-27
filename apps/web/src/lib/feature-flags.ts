import { cache } from 'react'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import {
  FEATURE_FLAGS, FEATURE_FLAG_POLICY, getRequiredFeaturesForApiPath, isFeatureKey,
  matchesFeatureApiPattern, type FeatureKey,
} from '@silvercare/contracts/src/generated/features'
import { getAppOrganizationId, getAppRole } from '@/lib/auth/app-role'
import { getActiveImpersonation, safeGetCookieStore } from '@/lib/impersonation-guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { createClient } from '@/lib/supabase/server'

export type EffectiveFeatureFlags = Record<FeatureKey, boolean>
type DbClient = Awaited<ReturnType<typeof createClient>>
type FeatureUser = Pick<User, 'id' | 'app_metadata'>

async function loadFlags(supabase: DbClient, organizationId: string): Promise<EffectiveFeatureFlags> {
  const { data, error } = await supabase.rpc('get_org_feature_flags', { p_org_id: organizationId })
  if (error || !Array.isArray(data) || data.length !== FEATURE_FLAGS.length) {
    throw new Error('FEATURE_FLAGS_UNAVAILABLE')
  }

  const flags: Partial<EffectiveFeatureFlags> = {}
  for (const { feature_key: key, enabled } of data) {
    if (!isFeatureKey(key) || typeof enabled !== 'boolean' || Object.hasOwn(flags, key)) {
      throw new Error('FEATURE_FLAGS_UNAVAILABLE')
    }
    flags[key] = enabled
  }
  return flags as EffectiveFeatureFlags
}

/** Reuse the tenant snapshot within a server render. */
export const getOrgFeatureFlags = cache(async (organizationId: string) =>
  loadFlags(await createClient(), organizationId),
)

export async function getOrgFeatureFlagsAdmin(organizationId: string) {
  return loadFlags(createAdminClient(), organizationId)
}

export async function getFeatureOrganizationId(user: FeatureUser) {
  const session = getAppRole(user) === 'super_admin'
    ? getActiveImpersonation(await safeGetCookieStore(), user)
    : null
  return session?.targetOrgId ?? getAppOrganizationId(user)
}

export const getCurrentFeatureFlags = cache(async () => {
  const user = await getCurrentUser()
  if (!user || !getAppRole(user)) return null
  const organizationId = await getFeatureOrganizationId(user)
  if (!organizationId) return null
  try {
    return { organizationId, flags: await getOrgFeatureFlags(organizationId) }
  } catch {
    return null
  }
})

export async function requireOrgFeature(feature: string) {
  const context = isFeatureKey(feature) ? await getCurrentFeatureFlags() : null
  return { allowed: Boolean(context?.flags[feature as FeatureKey]), feature, organizationId: context?.organizationId ?? null }
}

function featureDisabled(feature: FeatureKey, pathname: string, context: { userId?: string; organizationId?: string }) {
  // Log a static route pattern. Dynamic URL segments and query strings can contain sensitive data.
  const path = FEATURE_FLAGS.flatMap((flag) => [...flag.apiPrefixes])
    .filter((pattern) => matchesFeatureApiPattern(pathname, pattern))
    .sort((a, b) => b.length - a.length)[0] ?? '/api'
  console.warn(`[FEATURE_DISABLED_403] user_id=${context.userId ?? '-'} org_id=${context.organizationId ?? '-'} feature=${feature} path=${path}`)
  return NextResponse.json({
    error: featureDisabledMessage,
    code: FEATURE_FLAG_POLICY.disabledErrorCode,
    feature,
  }, { status: 403 })
}

function unmappedFeatureRoute() {
  console.error('[FEATURE_ROUTE_UNMAPPED]')
  return NextResponse.json({ error: featureDisabledMessage, code: FEATURE_FLAG_POLICY.disabledErrorCode }, { status: 403 })
}

export async function assertOrgFeatureForApi(
  supabase: DbClient, user: FeatureUser, featureOrPath: FeatureKey | readonly FeatureKey[] | string, pathname?: string,
) {
  const route = pathname ?? (typeof featureOrPath === 'string' ? featureOrPath : '')
  const required = typeof featureOrPath === 'string'
    ? isFeatureKey(featureOrPath) ? [featureOrPath] : getRequiredFeaturesForApiPath(featureOrPath)
    : featureOrPath
  if (!required.length) return unmappedFeatureRoute()

  const organizationId = await getFeatureOrganizationId(user)
  const flags = organizationId ? await loadFlags(supabase, organizationId).catch(() => null) : null
  const disabled = required.find((feature) => !flags?.[feature])
  return disabled ? featureDisabled(disabled, route, { userId: user.id, organizationId: organizationId ?? undefined }) : null
}

export const featureDisabledMessage = 'Ten moduł jest niedostępny w Twojej placówce.'

export async function isOrgFeatureEnabled(supabase: DbClient, organizationId: string | null | undefined, feature: FeatureKey) {
  if (!organizationId) return false
  const { data, error } = await supabase.rpc('has_org_feature', { p_org_id: organizationId, p_feature_key: feature })
  return !error && data === true
}

/** The organization must come from a server-side record authorized by the caller. */
export async function assertTargetOrgFeatureForApi(
  supabase: DbClient, organizationId: string, pathname: string, userId?: string,
) {
  const required = getRequiredFeaturesForApiPath(pathname)
  if (!required.length) return unmappedFeatureRoute()
  for (const feature of required) {
    if (!(await isOrgFeatureEnabled(supabase, organizationId, feature))) {
      return featureDisabled(feature, pathname, { organizationId, userId })
    }
  }
  return null
}
