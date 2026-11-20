import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * @REQ: ADM-RESIDENT-FUNDING
 * @REQ: SEC-NO-PII-LOGS
 *
 * Zapis źródła finansowania (SC-ADM-24): tylko kierownik placówki, tylko wartości z listy,
 * zapis klientem sesji (RLS) i ślad w audit_logs bez danych osobowych.
 */

type Call = { table: string; method: string; args: unknown[] }
const state = {
  user: null as null | { id: string; app_metadata: Record<string, unknown> },
  calls: [] as Call[],
  results: {} as Record<string, { data: unknown; error: { code: string; message: string } | null }>,
}

function client() {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) },
    rpc: vi.fn(async () => ({ data: true, error: null })),
    from: (table: string) => {
      const b: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'maybeSingle', 'upsert', 'insert']) {
        b[method] = (...args: unknown[]) => {
          state.calls.push({ table, method, args })
          return b
        }
      }
      b.then = (res: (v: unknown) => unknown) =>
        Promise.resolve(state.results[`${table}`] ?? { data: null, error: null }).then(res)
      return b
    },
  }
}

vi.mock('../../apps/web/src/lib/supabase/server', () => ({ createClient: vi.fn(async () => client()) }))
vi.mock('../../apps/web/src/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => client()) }))
vi.mock('../../apps/web/node_modules/next/headers.js', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('../../apps/web/node_modules/next/cache.js', () => ({ revalidatePath: vi.fn() }))

const writes = () => state.calls.filter((c) => c.method === 'upsert' || c.method === 'insert')

describe('updateResidentFundingAction (@REQ: ADM-RESIDENT-FUNDING)', () => {
  beforeEach(() => {
    state.user = null
    state.calls = []
    state.results = {}
  })

  it('@REQ: ADM-RESIDENT-FUNDING - bez sesji i dla ról innych niż kierownik placówki: odmowa bez zapisu', async () => {
    const { updateResidentFundingAction } = await import('../../apps/web/src/actions/resident-funding')
    expect((await updateResidentFundingAction('r1', 'private')).success).toBe(false)

    for (const role of ['nurse', 'family', 'legal_guardian', 'super_admin', undefined]) {
      state.user = { id: 'u1', app_metadata: { role, organization_id: 'o1' } }
      const res = await updateResidentFundingAction('r1', 'private')
      expect(res.success, String(role)).toBe(false)
    }
    expect(writes()).toHaveLength(0)
  })

  it('@REQ: ADM-RESIDENT-FUNDING - wartość spoza listy jest odrzucana przed zapytaniem', async () => {
    const { updateResidentFundingAction } = await import('../../apps/web/src/actions/resident-funding')
    state.user = { id: 'u1', app_metadata: { role: 'org_admin', organization_id: 'o1' } }
    for (const value of ['nfz', '', 'Brak danych']) {
      expect((await updateResidentFundingAction('r1', value)).success, value).toBe(false)
    }
    expect(writes()).toHaveLength(0)
  })

  it('@REQ: SEC-NO-PII-LOGS - kierownik zapisuje wartość, a audyt ma tylko identyfikator i kody', async () => {
    const { updateResidentFundingAction } = await import('../../apps/web/src/actions/resident-funding')
    state.user = { id: 'u1', app_metadata: { role: 'org_admin', organization_id: 'o1' } }
    state.results.resident_funding = { data: { funding_source: 'private' }, error: null }

    const res = await updateResidentFundingAction('r1', 'municipality')
    expect(res).toEqual({ success: true })

    const upsert = state.calls.find((c) => c.table === 'resident_funding' && c.method === 'upsert')
    expect(upsert?.args[0]).toMatchObject({ resident_id: 'r1', organization_id: 'o1', funding_source: 'municipality', updated_by: 'u1' })

    const audit = state.calls.find((c) => c.table === 'audit_logs' && c.method === 'insert')
    expect(audit?.args[0]).toEqual({
      organization_id: 'o1',
      performed_by: 'u1',
      action: 'RESIDENT_FUNDING_CHANGED',
      payload: { target_table: 'resident_funding', target_id: 'r1', from: 'private', to: 'municipality' },
    })
  })

  it('@REQ: SEC-NO-PII-LOGS - błąd zapisu to porażka z logiem samego kodu', async () => {
    const { updateResidentFundingAction } = await import('../../apps/web/src/actions/resident-funding')
    state.user = { id: 'u1', app_metadata: { role: 'org_admin', organization_id: 'o1' } }
    state.results.resident_funding = { data: null, error: { code: '42501', message: 'Maria Testowa 90010112345' } }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await updateResidentFundingAction('r1', 'other')
    expect(res.success).toBe(false)
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/Testowa|90010112345/)
    expect(state.calls.some((c) => c.table === 'audit_logs')).toBe(false)
    spy.mockRestore()
  })
})
