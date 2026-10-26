import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { searchGlobalAction } from '../../apps/web/src/actions/global-search'
import { mapSearchQueryResults } from '../../apps/web/src/lib/global-search-mappers'
import {
  normalizeForSearch,
  matchScore,
  rankSearchResults,
  type SearchResultItem,
} from '../../apps/web/src/lib/global-search-helpers'

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: MDR-VOCABULARY
 *
 * Kolejność wyników: dokładne słowo przed prefiksem przed samym zawieraniem fragmentu, bez względu na polskie
 * znaki. Przy równym dopasowaniu aktywny podopieczny jest przed archiwalnym. Grupy zachowują stałą kolejność.
 */

const item = (id: string, title: string, extra: Partial<SearchResultItem> = {}): SearchResultItem => ({
  id,
  title,
  subtitle: '',
  href: '/x',
  category: 'residents',
  ...extra,
})

describe('normalizeForSearch (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - małe litery i bez polskich znaków, także ł', () => {
    expect(normalizeForSearch('Żółw Łódź ĄĘĆŃÓŚŹŻ ąęćńóśźż')).toBe('zolw lodz aecnoszz aecnoszz')
  })
})

describe('matchScore (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - 0 dla dokładnego słowa, 1 dla prefiksu, 2 dla reszty', () => {
    expect(matchScore(item('1', 'Jan Kowalski'), 'Kowalski')).toBe(0)
    expect(matchScore(item('2', 'Jan Kowalski'), 'Kowal')).toBe(1)
    expect(matchScore(item('3', 'Jan Kowalski'), 'walski')).toBe(2)
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - nie zależy od wielkości liter ani polskich znaków', () => {
    expect(matchScore(item('1', 'Stanisław Wiśniewski'), 'wisniewski')).toBe(0)
    expect(matchScore(item('2', 'Stanisław Wiśniewski'), 'WIŚN')).toBe(1)
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - kilka słów: wszystkie dokładne → 0, wszystkie jako prefiksy → 1', () => {
    expect(matchScore(item('1', 'Stanisław Wiśniewski'), 'Wiśniewski Stanisław')).toBe(0)
    expect(matchScore(item('2', 'Stanisław Wiśniewski'), 'Stan Wiśn')).toBe(1)
    expect(matchScore(item('3', 'Stanisław Wiśniewski'), 'Stan Kowal')).toBe(2)
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - liczy też podtytuł (np. raport znaleziony po nazwisku podopiecznego)', () => {
    const report = item('r', 'Raport z dnia 2026-10-22', { subtitle: 'Podopieczny: Anna Kowalewska', category: 'reports' })
    expect(matchScore(report, 'Kowalewska')).toBe(0)
  })
})

describe('rankSearchResults (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - dokładne słowo, potem prefiks, potem fragment', () => {
    const ranked = rankSearchResults([item('c', 'Jan Kownowak'), item('b', 'Jan Nowakowski'), item('a', 'Jan Nowak')], 'Nowak')
    expect(ranked.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - przy równym dopasowaniu aktywny przed archiwalnym, a dokładny archiwalny przed prefiksem aktywnego', () => {
    const ranked = rankSearchResults(
      [
        item('archiwalny', 'Jan Kowal', { archived: true }),
        item('aktywny-prefiks', 'Jan Kowalski'),
        item('aktywny-dokladny', 'Anna Kowal'),
      ],
      'Kowal'
    )
    expect(ranked.map((r) => r.id)).toEqual(['aktywny-dokladny', 'archiwalny', 'aktywny-prefiks'])
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - zachowuje kolejność grup i obcina każdą do 6 pozycji', () => {
    const many = Array.from({ length: 9 }, (_, i) => item(`p${i}`, `Jan Kowalski${i}`))
    const rooms = [item('f1', 'Pokój 101', { category: 'facility' })]
    const ranked = rankSearchResults([...many, ...rooms], 'Jan')
    expect(ranked.filter((r) => r.category === 'residents')).toHaveLength(6)
    expect(ranked.map((r) => r.category)).toEqual([...Array(6).fill('residents'), 'facility'])
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - kolejność stabilna przy równych wynikach', () => {
    const ranked = rankSearchResults([item('1', 'Jan A'), item('2', 'Jan B'), item('3', 'Jan C')], 'Jan')
    expect(ranked.map((r) => r.id)).toEqual(['1', '2', '3'])
  })
})

describe('mapper stosuje ranking (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - pokój 101 przed pokojem 1010 dla frazy „101”', () => {
    const items = mapSearchQueryResults(
      {
        roomsData: [
          { id: 'r2', number: '1010', floor: 1, sector: 'A', organization_id: 'o', beds: [] },
          { id: 'r1', number: '101', floor: 1, sector: 'A', organization_id: 'o', beds: [] },
        ],
      },
      '101'
    )
    expect(items.map((i) => i.id)).toEqual(['r1', 'r2'])
  })

  it('@REQ: MDR-VOCABULARY - archiwalny z dokładnym nazwiskiem oznaczony jako archiwalny, nie ukryty', () => {
    const items = mapSearchQueryResults(
      {
        resData: [
          { id: 'a', first_name: 'Jan', last_name: 'Kowalski', care_level: null, is_zsn: false, bed_assignments: [], archived_at: '2026-01-01T00:00:00Z' },
          { id: 'b', first_name: 'Jan', last_name: 'Kowalskiewicz', care_level: null, is_zsn: false, bed_assignments: [] },
        ],
      },
      'Kowalski'
    )
    expect(items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(items[0].badge).toBe('Zarchiwizowany')
  })
})

describe('zapytania pobierają kandydatów do rankingu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('@REQ: UI-TEMPLATE-ALIGNMENT - podopieczni, pokoje, łóżka, plan dnia i raporty: limit 12 w bazie, 6 po rankingu', async () => {
    const calls: { table: string; method: string; args: unknown[] }[] = []
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'u', app_metadata: { role: 'org_admin', organization_id: 'org-1' }, user_metadata: {} } },
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

    await searchGlobalAction('Kowalski')
    for (const table of ['residents', 'rooms', 'beds', 'agenda_items', 'daily_reports']) {
      const limits = calls.filter((c) => c.table === table && c.method === 'limit').map((c) => c.args[0])
      expect(limits, table).toEqual([12])
    }
  })
})
