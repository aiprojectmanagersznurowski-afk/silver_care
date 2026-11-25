import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FEATURE_FLAGS, type FeatureKey, getAncestorFeatureKeys, getDependentFeatureKeys, getRequiredFeaturesForApiPath, resolveEffectiveFeatureFlags,
} from '@silvercare/contracts/src/generated/features'
import { assertOrgFeatureForApi, getOrgFeatureFlags, requireOrgFeature } from '@/lib/feature-flags'

const { rpc, getCurrentUser, getActiveImpersonation } = vi.hoisted(() => ({
  rpc: vi.fn(), getCurrentUser: vi.fn(), getActiveImpersonation: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: () => supabase }))
vi.mock('@/lib/supabase/current-user', () => ({ getCurrentUser }))
vi.mock('@/lib/impersonation-guards', () => ({
  safeGetCookieStore: vi.fn(), getActiveImpersonation,
}))

const supabase = { rpc }
function snapshot(overrides: Partial<Record<FeatureKey, boolean>> = {}) {
  const flags = resolveEffectiveFeatureFlags(overrides)
  return FEATURE_FLAGS.map(({ key }) => ({ feature_key: key, enabled: flags[key] }))
}
const user = { id: '1c78d737-268c-48af-a8b3-2a97854bef10', app_metadata: { role: 'org_admin', organization_id: 'org-a' } }
const parent = 'module_residents_management'
const portal = 'module_family_portal'

beforeEach(() => {
  getCurrentUser.mockResolvedValue(user)
  getActiveImpersonation.mockReturnValue(null)
  rpc.mockReset().mockResolvedValue({ data: snapshot(), error: null })
})

describe('@REQ: SUP-FEATURE-FLAGS', () => {
  it('bierze pod uwagę rodziców, zagnieżdżone delegacje i wszystkie dopasowania API', () => {
    expect(getAncestorFeatureKeys('allow_org_admin_contract_templates')).toContain(parent)
    expect(getDependentFeatureKeys(parent)).toContain('allow_org_admin_contract_templates')
    expect(resolveEffectiveFeatureFlags({ [portal]: true, [parent]: false })[portal]).toBe(false)
    expect(getRequiredFeaturesForApiPath('/api/residents/123/report/latest')).toEqual([parent, portal])
    expect(getRequiredFeaturesForApiPath('/api/admin/residents/123/contract')).toEqual([parent, 'module_documents_contracts'])
  })

  it('pobiera domyślne wartości i nadpisania ograniczone do placówki', async () => {
    expect((await getOrgFeatureFlags('org-a'))[portal]).toBe(true)
    rpc.mockResolvedValueOnce({ data: snapshot({ [parent]: false }), error: null })
    expect((await getOrgFeatureFlags('org-b'))[portal]).toBe(false)
    expect(rpc).toHaveBeenLastCalledWith('get_org_feature_flags', { p_org_id: 'org-b' })
  })

  it('korzysta z placówki podglądu i odrzuca nieznane klucze', async () => {
    getCurrentUser.mockResolvedValue({ ...user, app_metadata: { role: 'super_admin' } })
    getActiveImpersonation.mockReturnValue({ targetOrgId: 'target' })
    rpc.mockResolvedValueOnce({ data: snapshot({ [portal]: false }), error: null })
    expect(await requireOrgFeature(portal)).toMatchObject({ allowed: false, organizationId: 'target' })
    expect(rpc).toHaveBeenLastCalledWith('get_org_feature_flags', { p_org_id: 'target' })
    expect((await requireOrgFeature('invalid')).allowed).toBe(false)
  })

  it.each([[], snapshot().slice(1), snapshot().map(() => snapshot()[0])].map((rows) => ({ rows })))(
    'odrzuca niekompletny odczyt flag', async ({ rows }) => {
      rpc.mockResolvedValueOnce({ data: rows, error: null })
      await expect(getOrgFeatureFlags('org-a')).rejects.toThrow('FEATURE_FLAGS_UNAVAILABLE')
    },
  )

  it('odrzuca chronioną trasę bez mapowania z kontraktu', async () => {
    const response = await assertOrgFeatureForApi(supabase as never, user, '/api/unmapped')
    expect(response?.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('zwraca 403 przy dowolnej wyłączonej fladze i loguje wzorzec trasy', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    rpc.mockResolvedValueOnce({ data: snapshot({ ['module_documents_contracts']: false }), error: null })
    try {
      const response = await assertOrgFeatureForApi(
        supabase as never, user, '/api/admin/residents/example@example.invalid/contract',
      )
      expect(response?.status).toBe(403)
      expect(await response?.json()).toMatchObject({ code: 'FEATURE_DISABLED_FOR_ORG', feature: 'module_documents_contracts' })
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[FEATURE_DISABLED_403]'))
      expect(JSON.stringify(warn.mock.calls)).not.toContain('example@example.invalid')
    } finally {
      warn.mockRestore()
    }
  })
})
