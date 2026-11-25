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
vi.mock('next/headers.js', () => ({ cookies: async () => ({}) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { analyzeBulkImportAction, commitBulkImportAction } from '@/actions/bulk-import'
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

it('zapisuje wszystkie 60 rekordów jednym wywołaniem bazy @REQ: ADM-RESIDENT-ADD', async () => {
  session('org_admin')
  mocks.feature.mockResolvedValue(true)
  const rows = Array.from({ length: 60 }, (_, index) => {
    const stem = '400101' + String(index).padStart(4, '0')
    const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]
    const sum = [...stem].reduce((total, digit, position) => total + Number(digit) * weights[position], 0)
    return {
      rowNumber: index + 2, firstName: 'Test', lastName: String(index),
      nationalId: stem + String((10 - sum % 10) % 10),
      gender: 'M' as const, birthDate: '1940-01-01', careLevel: 'walking' as const,
      isZsn: false, notes: null, admissionDate: null, isValid: true, errors: [],
    }
  })
  const insert = vi.fn((batch: unknown[]) => ({ select: async () => ({
    data: batch.map((_, index) => ({ id: String(index) })), error: null,
  }) }))
  mocks.createAdminClient.mockReturnValue({
    from: (table: string) => table === 'residents' ? {
      insert,
      select: () => ({ eq: () => ({ is: async () => ({ data: [] }) }) }),
    } : {
      select: () => ({ eq: () => ({ single: async () => ({ data: { resident_limit: 60 } }) }) }),
      insert: async () => ({}),
    },
  })
  await commitBulkImportAction(rows).catch((error: unknown) => { if (!insert.mock.calls.length) throw error })
  expect(insert).toHaveBeenCalledTimes(1)
  expect(insert.mock.calls[0][0]).toHaveLength(60)
})
