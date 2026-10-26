import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { searchGlobalAction } from '../../apps/web/src/actions/global-search'
import { splitSearchWords } from '../../apps/web/src/lib/global-search-helpers'

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: ORG-ISOLATION
 *
 * Imię i nazwisko wpisane razem („Jan Kowalski”, także w odwrotnej kolejności i skrótami) muszą znaleźć
 * podopiecznego: każde słowo ma pasować do imienia albo nazwiska, a wszystkie słowa naraz.
 */

type Call = { table: string; method: string; args: unknown[] }

function mockStaff(role = 'org_admin') {
  const calls: Call[] = []
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'u-1', app_metadata: { role, organization_id: 'org-1' }, user_metadata: {} } },
      }),
    },
    from: (table: string) => {
      const b: Record<string, unknown> = {}
      for (const method of ['select', 'is', 'or', 'ilike', 'eq', 'gte', 'lte', 'limit', 'order']) {
        b[method] = (...args: unknown[]) => {
          calls.push({ table, method, args })
          return b
        }
      }
      b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(res, rej)
      return b
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  return calls
}

const orCalls = (calls: Call[], table: string) => calls.filter((c) => c.table === table && c.method === 'or')
const nameFilter = (w: string) => `first_name.ilike.%${w}%,last_name.ilike.%${w}%`

describe('splitSearchWords (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - dzieli frazę na słowa i ogranicza ich liczbę', () => {
    expect(splitSearchWords('Jan Kowalski')).toEqual(['Jan', 'Kowalski'])
    expect(splitSearchWords('Jan')).toEqual(['Jan'])
    expect(splitSearchWords('a b c d e f g')).toHaveLength(4)
    expect(splitSearchWords('')).toEqual([])
  })
})

describe('imię i nazwisko razem (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('@REQ: UI-TEMPLATE-ALIGNMENT - jedno słowo: jeden filtr po imieniu lub nazwisku, jak dotąd', async () => {
    const calls = mockStaff()
    await searchGlobalAction('Kowalski', 'residents')
    expect(orCalls(calls, 'residents').map((c) => c.args[0])).toEqual([nameFilter('Kowalski')])
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - dwa słowa: osobny filtr dla każdego, łączone warunkiem „i”', async () => {
    const calls = mockStaff()
    await searchGlobalAction('Jan Kowalski', 'residents')
    expect(orCalls(calls, 'residents').map((c) => c.args[0])).toEqual([nameFilter('Jan'), nameFilter('Kowalski')])
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - raporty szukają po podopiecznym tak samo, przez tabelę podopiecznych', async () => {
    const calls = mockStaff('nurse')
    await searchGlobalAction('Jan Kowalski', 'reports')
    const ors = orCalls(calls, 'daily_reports')
    expect(ors.map((c) => c.args[0])).toEqual([nameFilter('Jan'), nameFilter('Kowalski')])
    expect(ors.every((c) => (c.args[1] as { foreignTable?: string })?.foreignTable === 'residents')).toBe(true)
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - pełna data nadal zawęża raporty do dnia, bez filtra po nazwisku', async () => {
    const calls = mockStaff()
    await searchGlobalAction('2026-10-24', 'reports')
    expect(orCalls(calls, 'daily_reports')).toHaveLength(0)
    expect(calls.some((c) => c.table === 'daily_reports' && c.method === 'gte')).toBe(true)
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - bardzo długa fraza nie mnoży filtrów ponad limit słów', async () => {
    const calls = mockStaff()
    await searchGlobalAction('a1 b2 c3 d4 e5 f6 g7', 'residents')
    expect(orCalls(calls, 'residents')).toHaveLength(4)
  })

  it('@REQ: ORG-ISOLATION - filtr organizacji zostaje przy frazie z wieloma słowami', async () => {
    const calls = mockStaff()
    await searchGlobalAction('Jan Kowalski', 'residents')
    expect(calls.some((c) => c.table === 'residents' && c.method === 'eq' && c.args[0] === 'organization_id')).toBe(true)
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - zadania planu dnia nadal szukają całej frazy (np. „Wizyta lekarska”)', async () => {
    const calls = mockStaff()
    await searchGlobalAction('Wizyta lekarska', 'agenda')
    expect(calls.filter((c) => c.table === 'agenda_items' && c.method === 'ilike').map((c) => c.args)).toEqual([['title', '%Wizyta lekarska%']])
  })
})
