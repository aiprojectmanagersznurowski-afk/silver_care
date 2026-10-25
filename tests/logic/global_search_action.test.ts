import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { searchGlobalAction } from '../../apps/web/src/actions/global-search'
import { isStaffRole, categoriesToSearch } from '../../apps/web/src/lib/global-search-helpers'

/**
 * @REQ: ORG-ISOLATION
 * @REQ: UI-FOUR-STATES
 * @REQ: SEC-NO-PII-LOGS
 *
 * Wyszukiwarka jest dla personelu z kontraktu (super_admin, org_admin, nurse). Rodzina, opiekun prawny
 * i konto bez roli dostają odmowę zanim powstanie jakiekolwiek zapytanie. Błąd bazy to jawny błąd,
 * nigdy „brak wyników", i nie ujawnia treści komunikatu bazy.
 */

type Call = { table: string; method: string; args: unknown[] }
type Result = { data: unknown[] | null; error: { code: string; message: string } | null }

function mockClient(
  appMetadata: Record<string, unknown> | null,
  opts: { failTables?: Record<string, Result | 'reject'>; userMetadata?: Record<string, unknown> } = {}
) {
  const calls: Call[] = []
  const from = vi.fn((table: string) => {
    const b: Record<string, unknown> = {}
    for (const method of ['select', 'is', 'or', 'ilike', 'eq', 'gte', 'lte', 'limit']) {
      b[method] = (...args: unknown[]) => {
        calls.push({ table, method, args })
        return b
      }
    }
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const fail = opts.failTables?.[table]
      const p = fail === 'reject' ? Promise.reject(new Error('połączenie utracone')) : Promise.resolve(fail ?? { data: [], error: null })
      return p.then(res, rej)
    }
    return b
  })
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: appMetadata === null ? null : { id: 'u-1', app_metadata: appMetadata, user_metadata: opts.userMetadata ?? {} } },
      }),
    },
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { calls, from }
}

const ORG = '11111111-1111-1111-1111-111111111111'

describe('searchGlobalAction: dostęp tylko dla personelu (@REQ: ORG-ISOLATION)', () => {
  beforeEach(() => vi.clearAllMocks())

  for (const role of ['family', 'legal_guardian', undefined, 'admin']) {
    it(`@REQ: ORG-ISOLATION - rola ${String(role)} dostaje odmowę bez zapytania do bazy`, async () => {
      const { from } = mockClient({ role, organization_id: ORG })
      const res = await searchGlobalAction('Kowalski')
      expect(res.success).toBe(false)
      expect(res.items).toEqual([])
      expect(from).not.toHaveBeenCalled()
    })
  }

  it('@REQ: ORG-ISOLATION - rola z user_metadata nie nadaje dostępu', async () => {
    const { from } = mockClient({}, { userMetadata: { role: 'super_admin' } })
    const res = await searchGlobalAction('Kowalski')
    expect(res.success).toBe(false)
    expect(from).not.toHaveBeenCalled()
  })

  it('@REQ: ORG-ISOLATION - pielęgniarka i kierownik bez organizacji w tokenie dostają odmowę, nie zapytanie bez filtra', async () => {
    for (const role of ['nurse', 'org_admin']) {
      const { from } = mockClient({ role })
      const res = await searchGlobalAction('Kowalski')
      expect(res.success).toBe(false)
      expect(from).not.toHaveBeenCalled()
    }
  })

  it('@REQ: ORG-ISOLATION - kierownik z organizacją dostaje zapytania zawężone do tej organizacji', async () => {
    const { calls } = mockClient({ role: 'org_admin', organization_id: ORG })
    const res = await searchGlobalAction('Kowalski')
    expect(res.success).toBe(true)
    const tables = new Set(calls.map((c) => c.table))
    expect(tables).not.toContain('organizations')
    expect(calls.some((c) => c.table === 'residents' && c.method === 'eq' && c.args[0] === 'organization_id' && c.args[1] === ORG)).toBe(true)
  })

  it('@REQ: ORG-ISOLATION - super_admin bez organizacji szuka także placówek', async () => {
    const { calls } = mockClient({ role: 'super_admin' })
    const res = await searchGlobalAction('Sloneczna')
    expect(res.success).toBe(true)
    expect(calls.some((c) => c.table === 'organizations')).toBe(true)
  })

  it('@REQ: ORG-ISOLATION - wybrana kategoria odpytuje tylko swoje tabele', async () => {
    const { calls } = mockClient({ role: 'nurse', organization_id: ORG })
    await searchGlobalAction('Sniadanie', 'agenda')
    expect([...new Set(calls.map((c) => c.table))]).toEqual(['agenda_items'])
  })
})

describe('searchGlobalAction: błędy są jawne (@REQ: UI-FOUR-STATES, @REQ: SEC-NO-PII-LOGS)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('@REQ: UI-FOUR-STATES - błąd zapytania do jednej tabeli to błąd, a nie lista bez tej grupy', async () => {
    mockClient({ role: 'org_admin', organization_id: ORG }, {
      failTables: { rooms: { data: null, error: { code: '42501', message: 'permission denied for table rooms, Jan Kowalski' } } },
    })
    const res = await searchGlobalAction('Kowalski')
    expect(res.success).toBe(false)
    expect(res.items).toEqual([])
    expect(res.error).toBeTruthy()
  })

  it('@REQ: SEC-NO-PII-LOGS - komunikat błędu nie zawiera treści z bazy ani wyjątku', async () => {
    mockClient({ role: 'org_admin', organization_id: ORG }, {
      failTables: { residents: { data: null, error: { code: 'XX000', message: 'Jan Kowalski 90010112345' } } },
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await searchGlobalAction('Kowalski')
    expect(res.error).not.toMatch(/Kowalski|90010112345|XX000/)
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/Kowalski|90010112345/)
    spy.mockRestore()
  })

  it('@REQ: UI-FOUR-STATES - odrzucone zapytanie też kończy się jawnym błędem', async () => {
    mockClient({ role: 'nurse', organization_id: ORG }, { failTables: { agenda_items: 'reject' } })
    const res = await searchGlobalAction('Sniadanie')
    expect(res.success).toBe(false)
    expect(res.error).not.toContain('połączenie utracone')
  })
})

describe('pomocniki dostępu (@REQ: ORG-ISOLATION)', () => {
  it('@REQ: ORG-ISOLATION - isStaffRole zgodne z rolami personelu z kontraktu', () => {
    expect(['super_admin', 'org_admin', 'nurse'].every(isStaffRole)).toBe(true)
    expect(['family', 'legal_guardian', 'admin', '', undefined, null].some((r) => isStaffRole(r))).toBe(false)
  })

  it('@REQ: ORG-ISOLATION - categoriesToSearch: „wszystko" tylko z kategorii dostępnych dla roli, bez niezaimplementowanych', () => {
    expect(categoriesToSearch('all', 'nurse')).toEqual(['residents', 'facility', 'agenda', 'reports'])
    expect(categoriesToSearch('all', 'super_admin')).toContain('organizations')
    expect(categoriesToSearch('organizations', 'org_admin')).toEqual([])
    expect(categoriesToSearch('agenda', 'nurse')).toEqual(['agenda'])
  })
})
