import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { searchGlobalAction } from '../../apps/web/src/actions/global-search'
import { mapSearchQueryResults } from '../../apps/web/src/lib/global-search-mappers'

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: ORG-ISOLATION
 *
 * Wynik wyszukiwarki prowadzi do karty podopiecznego w części aplikacji właściwej dla roli
 * (pielęgniarka → /staff/residents/<id>, kierownik i superadmin → /admin/residents/<id>).
 * Pielęgniarka nie ma widoku struktury placówki: zajęte łóżko prowadzi do karty podopiecznego,
 * a wolne łóżko i pusty pokój są w wynikach bez linku (decyzja Michała 2026-10-26).
 */

const resident = { id: 'res-1', first_name: 'Jan', last_name: 'Kowalski', care_level: null, is_zsn: false, bed_assignments: [] }
const room = (beds: unknown[]) => ({ id: 'room-1', number: '101', floor: 1, sector: 'A', organization_id: 'o', beds })
const occupied = { id: 'bed-1', label: '1', bed_assignments: [{ unassigned_at: null, residents: { id: 'res-9', first_name: 'Anna', last_name: 'Nowak' } }] }
const free = { id: 'bed-2', label: '2', bed_assignments: [] }

describe('link do karty podopiecznego według roli (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - pielęgniarka → karta personelu, kierownik i superadmin → karta kierownika', () => {
    expect(mapSearchQueryResults({ resData: [resident] }, 'Kowalski', 'nurse')[0].href).toBe('/staff/residents/res-1')
    expect(mapSearchQueryResults({ resData: [resident] }, 'Kowalski', 'org_admin')[0].href).toBe('/admin/residents/res-1')
    expect(mapSearchQueryResults({ resData: [resident] }, 'Kowalski', 'super_admin')[0].href).toBe('/admin/residents/res-1')
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - pielęgniarka: zajęte łóżko → karta podopiecznego, wolne łóżko i pusty pokój bez linku', () => {
    const items = mapSearchQueryResults({ roomsData: [room([occupied, free])] }, '101', 'nurse')
    expect(items.find((i) => i.id === 'bed-1')?.href).toBe('/staff/residents/res-9')
    expect(items.find((i) => i.id === 'bed-2')?.href).toBeUndefined()
    const empty = mapSearchQueryResults({ roomsData: [room([])] }, '101', 'nurse')
    expect(empty[0].href).toBeUndefined()
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - kierownik: pokoje i łóżka prowadzą do struktury placówki', () => {
    const items = mapSearchQueryResults({ roomsData: [room([occupied, free])] }, '101', 'org_admin')
    expect(items.every((i) => i.href === '/admin/facility')).toBe(true)
  })
})

describe('zapytania pobierają identyfikator podopiecznego w łóżku (@REQ: ORG-ISOLATION)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('@REQ: ORG-ISOLATION - pokoje i łóżka wybierają residents(id, …); filtr organizacji zostaje', async () => {
    const calls: { table: string; method: string; args: unknown[] }[] = []
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u', app_metadata: { role: 'nurse', organization_id: 'org-1' }, user_metadata: {} } } }) },
      from: (table: string) => {
        const b: Record<string, unknown> = {}
        for (const method of ['select', 'is', 'or', 'ilike', 'eq', 'gte', 'lte', 'limit', 'order']) {
          b[method] = (...args: unknown[]) => {
            calls.push({ table, method, args })
            return b
          }
        }
        b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res, rej)
        return b
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    await searchGlobalAction('101', 'facility')
    for (const table of ['rooms', 'beds']) {
      const select = String(calls.find((c) => c.table === table && c.method === 'select')?.args[0])
      expect(select, table).toMatch(/residents\(id, first_name, last_name\)/)
    }
    expect(calls.some((c) => c.table === 'rooms' && c.method === 'eq' && c.args[0] === 'organization_id')).toBe(true)
  })
})
