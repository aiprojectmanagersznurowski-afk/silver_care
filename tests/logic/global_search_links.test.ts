import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { searchGlobalAction } from '../../apps/web/src/actions/global-search'
import { mapSearchQueryResults } from '../../apps/web/src/lib/global-search-mappers'

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: ORG-ISOLATION
 *
 * Wyniki planu dnia i raportów prowadzą do widoków personelu (decyzja Michała 2026-10-26), a nie do portalu
 * rodziny ani do ogólnej listy: raport → /staff/reports?resident=<id>, zadanie → /staff/agenda.
 * Raporty znalezione w bazie po każdym słowie frazy nie są potem odrzucane przez sprawdzanie całej frazy.
 */

const report = (id: string, residentId: string, first: string, last: string) => ({
  id,
  created_at: '2026-10-22T08:00:00Z',
  status: 'PUBLISHED',
  residents: { id: residentId, first_name: first, last_name: last },
})

describe('linki wyników planu dnia i raportów (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - zadanie z planu dnia prowadzi do planu dnia personelu, nie do portalu rodziny', () => {
    const [item] = mapSearchQueryResults(
      { agendaData: [{ id: 'a1', title: 'Śniadanie', time: '08:00', residents: null }] },
      'Śniadanie'
    )
    expect(item.href).toBe('/staff/agenda')
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - raport prowadzi do raportów personelu tego podopiecznego', () => {
    const [item] = mapSearchQueryResults({ reportsData: [report('rep1', 'res-42', 'Stanisław', 'Wiśniewski')] }, 'Wiśniewski')
    expect(item.href).toBe('/staff/reports?resident=res-42')
  })
})

describe('raporty po imieniu i nazwisku (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - odwrócona kolejność i skróty zostają w wynikach, jak w zapytaniu do bazy', () => {
    for (const q of ['Stanisław Wiśniewski', 'Wiśniewski Stanisław', 'Stan Wiśn', 'wisniewski']) {
      const items = mapSearchQueryResults({ reportsData: [report('rep1', 'res-1', 'Stanisław', 'Wiśniewski')] }, q)
      expect(items, q).toHaveLength(1)
    }
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - raport innej osoby nie przechodzi (wszystkie słowa muszą pasować)', () => {
    const items = mapSearchQueryResults({ reportsData: [report('rep1', 'res-1', 'Stanisław', 'Wiśniewski')] }, 'Stanisław Kowalski')
    expect(items).toHaveLength(0)
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - pełna data nadal znajduje raport z tego dnia', () => {
    const items = mapSearchQueryResults({ reportsData: [report('rep1', 'res-1', 'Anna', 'Nowak')] }, '2026-10-22')
    expect(items).toHaveLength(1)
  })
})

describe('zapytanie o raporty pobiera identyfikator podopiecznego (@REQ: ORG-ISOLATION)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('@REQ: ORG-ISOLATION - select raportów zawiera residents!inner(id, …), filtr organizacji zostaje', async () => {
    const calls: { table: string; method: string; args: unknown[] }[] = []
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'u', app_metadata: { role: 'nurse', organization_id: 'org-1' }, user_metadata: {} } },
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

    await searchGlobalAction('Kowalski', 'reports')
    const select = String(calls.find((c) => c.table === 'daily_reports' && c.method === 'select')?.args[0])
    expect(select).toMatch(/residents!inner\(id,/)
    expect(calls.some((c) => c.table === 'daily_reports' && c.method === 'eq' && c.args[0] === 'residents.organization_id')).toBe(true)
  })
})
