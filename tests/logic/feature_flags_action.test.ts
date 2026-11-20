import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toggleOrganizationFeatureFlagAction } from '@/actions/organization-feature-flags'

const { getUser, rpc, revalidatePath, getActiveImpersonation } = vi.hoisted(() => ({
  getUser: vi.fn(), rpc: vi.fn(), revalidatePath: vi.fn(), getActiveImpersonation: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({ auth: { getUser }, rpc }) }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/impersonation-guards', async (importOriginal) => ({
  ...await importOriginal<object>(), safeGetCookieStore: vi.fn(), getActiveImpersonation,
}))

const input = {
  organizationId: '79f93077-a1a6-4716-8b62-18ecf4d0aa4b', featureKey: 'module_family_portal', enabled: false,
}

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ error: null })
  getActiveImpersonation.mockReturnValue(null)
  getUser.mockResolvedValue({ data: { user: { id: 'user-id', app_metadata: { role: 'super_admin' } } } })
})

describe('@REQ: SUP-FEATURE-FLAGS', () => {
  it('odrzuca rolę kierownika i podgląd placówki', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: 'user-id', app_metadata: { role: 'org_admin' } } } })
    expect(await toggleOrganizationFeatureFlagAction(input)).toMatchObject({ ok: false })
    getActiveImpersonation.mockReturnValue({ targetOrgId: input.organizationId })
    expect(await toggleOrganizationFeatureFlagAction(input)).toMatchObject({ ok: false })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('zapisuje wyłącznie przez RPC w sesji operatora', async () => {
    expect(await toggleOrganizationFeatureFlagAction(input)).toMatchObject({ ok: true })
    expect(rpc).toHaveBeenCalledWith('set_organization_feature_flag', {
      p_org_id: input.organizationId, p_feature_key: input.featureKey, p_enabled: false,
    })
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/organizations/${input.organizationId}`)
  })
})
