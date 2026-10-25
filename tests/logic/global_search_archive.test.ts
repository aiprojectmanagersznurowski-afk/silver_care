import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { searchGlobalAction } from '../../apps/web/src/actions/global-search'
import { mapSearchQueryResults } from '../../apps/web/src/lib/global-search-mappers'

/**
 * @REQ: ORG-ISOLATION
 * @REQ: MDR-VOCABULARY
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Wyszukiwarka personelu obejmuje też podopiecznych zarchiwizowanych i po zgonie. Status to fakt
 * (te same etykiety co lista podopiecznych), plakietka jest neutralna, a aktywni są przed archiwalnymi.
 */

type Call = { table: string; method: string; args: unknown[] }

function mockStaff(role: string) {
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

const row = (id: string, last: string, extra: Record<string, unknown> = {}) => ({
  id,
  first_name: 'Jan',
  last_name: last,
  care_level: null,
  is_zsn: false,
  bed_assignments: [],
  archived_at: null,
  death_date: null,
  contract_end_date: null,
  ...extra,
})

const map = (rows: unknown[]) => mapSearchQueryResults({ resData: rows }, 'Jan')

describe('zapytanie obejmuje archiwum i zgony (@REQ: ORG-ISOLATION)', () => {
  beforeEach(() => vi.clearAllMocks())

  for (const role of ['org_admin', 'nurse']) {
    it(`@REQ: ORG-ISOLATION - ${role}: brak filtra archived_at, wybrane pola statusu, aktywni najpierw`, async () => {
      const calls = mockStaff(role)
      await searchGlobalAction('Kowalski', 'residents')
      const residents = calls.filter((c) => c.table === 'residents')

      expect(residents.some((c) => c.method === 'is' && c.args[0] === 'archived_at')).toBe(false)
      const select = String(residents.find((c) => c.method === 'select')?.args[0])
      for (const field of ['archived_at', 'death_date', 'contract_end_date']) expect(select).toContain(field)
      expect(residents.find((c) => c.method === 'order')?.args).toEqual(['archived_at', { ascending: true, nullsFirst: true }])
      expect(residents.some((c) => c.method === 'eq' && c.args[0] === 'organization_id')).toBe(true)
    })
  }
})

describe('wynik pokazuje status jako fakt (@REQ: MDR-VOCABULARY, @REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - aktywny podopieczny bez plakietki statusu, z łóżkiem w podtytule', () => {
    const [item] = map([
      row('r1', 'Aktywny', { bed_assignments: [{ unassigned_at: null, beds: { label: '2', rooms: { number: '204' } } }] }),
    ])
    expect(item.badge).toBeUndefined()
    expect(item.subtitle).toBe('Pokój 204, łóżko 2')
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - zarchiwizowany: plakietka „Zarchiwizowany” i data w podtytule', () => {
    const [item] = map([row('r2', 'Archiwalny', { archived_at: '2026-10-22T08:00:00Z' })])
    expect(item.badge).toBe('Zarchiwizowany')
    expect(item.subtitle).toBe('Zarchiwizowany: 22.10.2026')
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - po zgonie: plakietka „Zgon” i data zgonu w podtytule', () => {
    const [item] = map([row('r3', 'Zmarly', { death_date: '2026-10-22' })])
    expect(item.badge).toBe('Zgon')
    expect(item.subtitle).toBe('Zgon: 22.10.2026')
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - po zgonie i w archiwum: ta sama etykieta co lista podopiecznych, data zgonu w podtytule', () => {
    const [item] = map([row('r4', 'Oba', { archived_at: '2026-10-23T08:00:00Z', death_date: '2026-10-22' })])
    expect(item.badge).toBe('Zarchiwizowany')
    expect(item.subtitle).toBe('Zgon: 22.10.2026')
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - wypisany (koniec umowy) ma plakietkę „Wypisany”', () => {
    const [item] = map([row('r5', 'Wypisany', { contract_end_date: '2020-01-01' })])
    expect(item.badge).toBe('Wypisany')
  })

  it('@REQ: MDR-VOCABULARY - plakietki statusu są neutralne (bez wariantu destrukcyjnego) i bez słowa „pacjent”', () => {
    const items = map([
      row('a', 'A', { archived_at: '2026-10-22T08:00:00Z' }),
      row('b', 'B', { death_date: '2026-10-22' }),
      row('c', 'C', { contract_end_date: '2020-01-01' }),
    ])
    for (const item of items) {
      expect(item.badgeVariant).toBe('outline')
      expect(`${item.badge} ${item.subtitle} ${item.title}`.toLowerCase()).not.toContain('pacjent')
    }
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - aktywni podopieczni są przed archiwalnymi, kolejność w grupach zachowana', () => {
    const items = map([
      row('z1', 'Zmarly', { death_date: '2026-10-22' }),
      row('a1', 'Aktywny1'),
      row('ar1', 'Archiwalny', { archived_at: '2026-10-22T08:00:00Z' }),
      row('a2', 'Aktywny2'),
    ])
    expect(items.map((i) => i.id)).toEqual(['a1', 'a2', 'z1', 'ar1'])
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - ZSN pozostaje plakietką aktywnego podopiecznego', () => {
    const [item] = map([row('r6', 'Zsn', { is_zsn: true })])
    expect(item.badge).toBe('ZSN')
  })
})
