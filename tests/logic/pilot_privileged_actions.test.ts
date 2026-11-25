import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createAdminClient: vi.fn(), feature: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/feature-flags', () => ({ isOrgFeatureEnabled: mocks.feature, featureDisabledMessage: 'disabled' }))
vi.mock('@/lib/impersonation-guards', () => ({
  assertMutationAllowedDuringImpersonation: () => ({ allowed: true }),
  isImpersonationSessionActive: () => false,
  safeGetCookieStore: () => ({}),
}))
vi.mock('next/headers', () => ({ cookies: async () => ({}) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { analyzeBulkImportAction } from '@/actions/bulk-import'
import { bulkPublishReportsAction } from '@/actions/bulk-reports'

function session(role: string, aal = 'aal2') {
  mocks.createClient.mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: { id: 'auth-user', app_metadata: { role, organization_id: 'our-org' } } } }),
      getClaims: async () => ({ data: { claims: { sub: 'auth-user', aal } } }),
    },
    rpc: async () => ({ data: false, error: null }),
  })
}

describe('Uprawnienia operacji masowych @REQ: ORG-ISOLATION', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.feature.mockResolvedValue(true)
  })

  it.each([['family', 'aal2'], ['org_admin', 'aal1']])('blokuje podgląd importu dla %s i %s @REQ: SEC-MFA-STAFF', async (role, aal) => {
    session(role, aal)
    mocks.createAdminClient.mockImplementation(() => { throw new Error('privileged read') })
    await expect(analyzeBulkImportAction([])).resolves.toMatchObject({ error: expect.any(String) })
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it('blokuje zbiorczą publikację szkicu wymagającego sprawdzenia @REQ: REPORT-APPROVAL', async () => {
    session('nurse')
    const update = vi.fn(() => ({ in: async () => ({ error: null }) }))
    mocks.createAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({ in: async () => ({ data: [{
          id: 'draft', status: 'DRAFT', residents: { organization_id: 'our-org' },
          content: { requires_staff_review: true },
        }], error: null }) }),
        update,
        insert: async () => ({}),
      }),
    })
    const result = await bulkPublishReportsAction(['draft']).catch(() => null)
    expect(update).not.toHaveBeenCalled()
    expect(result).toMatchObject({ success: false })
  })
})
