import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * @REQ: ADM-RESIDENT-FUNDING
 *
 * Okno „Edytuj” karty podopiecznego zapisuje źródło pozyskania (residents.contract_source, SC-ADM-24/AC4)
 * przez updateResidentInlineAction: tylko wartości z listy CONTRACT_SOURCES albo puste (brak danych).
 */
type Call = { table: string; method: string; args: unknown[] }
const state = { calls: [] as Call[] }

function client() {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1', app_metadata: { role: 'org_admin', organization_id: 'o1' } } }, error: null })) },
    rpc: vi.fn(async () => ({ data: true, error: null })),
    from: (table: string) => {
      const b: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'single', 'update', 'insert']) {
        b[method] = (...args: unknown[]) => {
          state.calls.push({ table, method, args })
          return b
        }
      }
      b.then = (res: (v: unknown) => unknown) =>
        Promise.resolve(table === 'residents' ? { data: { id: 'r1', organization_id: 'o1' }, error: null } : { data: null, error: null }).then(res)
      return b
    },
  }
}

vi.mock('../../apps/web/src/lib/supabase/server', () => ({ createClient: vi.fn(async () => client()) }))
vi.mock('../../apps/web/src/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => client()) }))
vi.mock('../../apps/web/node_modules/next/headers.js', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('../../apps/web/node_modules/next/cache.js', () => ({ revalidatePath: vi.fn() }))

const residentUpdate = () => state.calls.find((c) => c.table === 'residents' && c.method === 'update')?.args[0] as Record<string, unknown> | undefined

describe('Edycja źródła pozyskania (@REQ: ADM-RESIDENT-FUNDING)', () => {
  beforeEach(() => {
    state.calls = []
  })

  it('@REQ: ADM-RESIDENT-FUNDING - kierownik zapisuje źródło pozyskania z listy', async () => {
    const { updateResidentInlineAction } = await import('../../apps/web/src/actions/resident-inline')
    const res = await updateResidentInlineAction({ residentId: 'r1', contract_source: 'hospital' })
    expect(res.success).toBe(true)
    expect(residentUpdate()).toMatchObject({ contract_source: 'hospital' })
  })

  it('@REQ: ADM-RESIDENT-FUNDING - puste źródło pozyskania zapisuje brak danych (null), nie wartość domyślną', async () => {
    const { updateResidentInlineAction } = await import('../../apps/web/src/actions/resident-inline')
    const res = await updateResidentInlineAction({ residentId: 'r1', contract_source: null })
    expect(res.success).toBe(true)
    expect(residentUpdate()).toMatchObject({ contract_source: null })
  })

  it('@REQ: ADM-RESIDENT-FUNDING - wartość spoza listy (np. zmyślone „private”) jest odrzucana bez zapisu', async () => {
    const { updateResidentInlineAction } = await import('../../apps/web/src/actions/resident-inline')
    for (const value of ['private', 'nfz']) {
      const res = await updateResidentInlineAction({ residentId: 'r1', contract_source: value })
      expect(res.success, value).toBe(false)
    }
    expect(residentUpdate()).toBeUndefined()
  })
})
