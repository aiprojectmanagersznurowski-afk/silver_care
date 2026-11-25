import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteResidentAction, deleteStaffAction } from '@/actions/admin'

const { rpc, from, createAdminClient } = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), createAdminClient: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'manager', app_metadata: { role: 'org_admin', organization_id: 'facility' } } } }) },
    rpc, from,
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('../../apps/web/node_modules/next/headers.js', () => ({ cookies: async () => ({ get: () => undefined }) }))

describe('@REQ: SUP-FEATURE-FLAGS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({ data: false, error: null })
  })

  it.each([
    [deleteResidentAction, 'module_residents_management'],
    [deleteStaffAction, 'module_facility_management'],
  ])('blokuje mutację w wyłączonym module %s', async (action, feature) => {
    const form = new FormData()
    form.set('id', 'target')
    expect(await action(form)).toMatchObject({ error: expect.any(String) })
    expect(rpc).toHaveBeenCalledWith('has_org_feature', { p_org_id: 'facility', p_feature_key: feature })
    expect(from).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})
