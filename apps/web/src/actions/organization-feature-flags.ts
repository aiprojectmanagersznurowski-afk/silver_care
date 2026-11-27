'use server'

import { revalidatePath } from 'next/cache'
import { FEATURE_FLAG_POLICY, isFeatureKey } from '@silvercare/contracts/src/generated/features'
import { getAppRole } from '@/lib/auth/app-role'
import { assertMutationAllowedDuringImpersonation, getActiveImpersonation, safeGetCookieStore } from '@/lib/impersonation-guards'
import { createClient } from '@/lib/supabase/server'

interface FlagInput {
  organizationId: string
  featureKey: string
  enabled: boolean
}

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

/** @REQ: SUP-FEATURE-FLAGS */
export async function toggleOrganizationFeatureFlagAction(input: FlagInput) {
  if (!input || typeof input.organizationId !== 'string' || !uuid.test(input.organizationId)
    || typeof input.featureKey !== 'string' || !isFeatureKey(input.featureKey) || typeof input.enabled !== 'boolean') {
    return { ok: false, error: 'Nieprawidłowe dane modułu.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (getAppRole(user) !== 'super_admin') return { ok: false, error: 'Brak uprawnień do zmiany modułów.' }

  const mutation = assertMutationAllowedDuringImpersonation(
    Boolean(getActiveImpersonation(await safeGetCookieStore(), user)),
  )
  if (!mutation.allowed) return { ok: false, error: mutation.error }

  const { organizationId, featureKey, enabled } = input
  const { error } = await supabase.rpc('set_organization_feature_flag', {
    p_org_id: organizationId, p_feature_key: featureKey, p_enabled: enabled,
  })
  if (error) {
    switch (error.message) {
      case FEATURE_FLAG_POLICY.dependencyErrorCode:
        return { ok: false, error: 'Najpierw włącz wymagane moduły nadrzędne.' }
      case 'FEATURE_FLAG_IMPERSONATION_BLOCKED':
        return { ok: false, error: 'Zakończ podgląd placówki przed zmianą modułów.' }
      case 'FEATURE_FLAG_AUTHORIZATION_REQUIRED':
        return { ok: false, error: 'Potwierdź drugi składnik uwierzytelniania przed zmianą modułów.' }
      default:
        return { ok: false, error: 'Nie udało się zapisać ustawienia modułu.' }
    }
  }

  revalidatePath(`/admin/organizations/${organizationId}`)
  for (const layout of ['/(admin)', '/(staff)', '/(family)']) revalidatePath(layout, 'layout')
  return { ok: true }
}
