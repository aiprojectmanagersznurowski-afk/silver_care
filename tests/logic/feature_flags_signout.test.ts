import { describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/auth/signout/route'

const { getUser, rpc, signOut, safeGetCookieStore } = vi.hoisted(() => ({
  getUser: vi.fn(), rpc: vi.fn(), signOut: vi.fn(), safeGetCookieStore: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({ auth: { getUser, signOut }, rpc }) }))
vi.mock('@/lib/impersonation-guards', async (importOriginal) => ({
  ...await importOriginal<object>(), safeGetCookieStore,
}))

describe('@REQ: SUP-FEATURE-FLAGS', () => {
  it('kończy podgląd w DB przed unieważnieniem sesji', async () => {
    safeGetCookieStore.mockResolvedValue({ get: () => ({ value: JSON.stringify({
      targetAdminId: 'admin', targetOrgId: 'org', impersonatorId: 'super', startedAt: new Date().toISOString(),
    }) }) })
    getUser.mockResolvedValue({ data: { user: { id: 'super', app_metadata: { role: 'super_admin' } } } })
    rpc.mockResolvedValue({ error: null })

    const response = await POST(new Request('https://example.test/auth/signout'))
    expect(rpc).toHaveBeenCalledWith('log_impersonation_stop', { p_target_admin_id: 'admin', p_target_org_id: 'org' })
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(signOut.mock.invocationCallOrder[0])
    expect(response.status).toBe(303)
  })
})
