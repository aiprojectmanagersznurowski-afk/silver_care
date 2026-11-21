import { describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/auth/signout/route'

const { getUser, rpc, signOut } = vi.hoisted(() => ({
  getUser: vi.fn(), rpc: vi.fn(), signOut: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: () => ({ auth: { getUser, signOut }, rpc }) }))
vi.mock('@/lib/impersonation-guards', async (importOriginal) => ({
  ...await importOriginal<object>(), safeGetCookieStore: async () => ({ get: () => undefined }),
}))

describe('@REQ: SUP-FEATURE-FLAGS', () => {
  it('kończy podgląd w DB bez ciasteczka przed unieważnieniem sesji', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'super', app_metadata: { role: 'super_admin' } } } })
    rpc.mockResolvedValue({ error: null })

    const response = await POST(new Request('https://example.test/auth/signout'))
    expect(rpc).toHaveBeenCalledWith('finish_impersonation')
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(signOut.mock.invocationCallOrder[0])
    expect(response.status).toBe(303)
  })
})
