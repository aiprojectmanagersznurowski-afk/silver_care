import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MATRIX } from '../../contracts/roles.contract.mjs'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
// Trasa importuje next/headers z apps/web/node_modules, więc podmieniamy dokładnie ten plik.
// Zwykła funkcja, nie vi.fn: clearAllMocks w beforeEach nie może skasować jej implementacji.
vi.mock('../../apps/web/node_modules/next/headers.js', () => ({ cookies: async () => ({ get: () => undefined }) }))

import { createClient } from '@/lib/supabase/server'
import { PATCH } from '../../apps/web/src/app/api/admin/residents/[id]/zsn/route'

/**
 * @REQ: ADM-RESIDENT-CARD-VISIBILITY
 *
 * PATCH /api/admin/residents/[id]/zsn: status ZSN wynika z dokumentacji przyjęcia, więc zmienia go wyłącznie
 * rola z prawem zapisu `residents` w macierzy (kierownik placówki, super admin). Personel opiekuńczy dostaje
 * odmowę przed zapisem. Zapis, który nie zmienił żadnego wiersza (np. odcięty przez RLS), jest błędem,
 * a nie sukcesem — interfejs nie może pokazać zmiany, której nie ma w bazie.
 */
type Op = [string, unknown[]]
type Call = { table: string; ops: Op[] }

function mockSupabase(role: string, updatedRows: unknown[] | null) {
  const calls: Call[] = []
  const from = (table: string) => {
    const call: Call = { table, ops: [] }
    calls.push(call)
    const chain: Record<string, unknown> = {}
    for (const op of ['select', 'eq', 'update']) {
      chain[op] = (...args: unknown[]) => { call.ops.push([op, args]); return chain }
    }
    chain.single = () => Promise.resolve({ data: { organization_id: 'o1' }, error: null })
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: updatedRows, error: null })
    return chain
  }
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', app_metadata: { role, organization_id: 'o1' } } }, error: null }) },
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  return calls
}

const patch = (body: unknown) =>
  PATCH(new Request('http://localhost/api/admin/residents/r1/zsn', { method: 'PATCH', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: 'r1' }),
  })

const updated = (calls: Call[]) => calls.some((c) => c.ops.some(([op]) => op === 'update'))

describe('PATCH /api/admin/residents/[id]/zsn (@REQ: ADM-RESIDENT-CARD-VISIBILITY)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('@REQ: ADM-RESIDENT-CARD-VISIBILITY - macierz: zapis residents ma kierownik placówki, nie personel opiekuńczy', () => {
    const residents = MATRIX.find((m) => m.resource === 'residents')
    expect(residents?.update.some((r: string) => r.startsWith('org_admin'))).toBe(true)
    expect(residents?.update.some((r: string) => r.startsWith('nurse'))).toBe(false)
  })

  it('@REQ: ADM-RESIDENT-CARD-VISIBILITY - personel opiekuńczy dostaje odmowę przed zapisem', async () => {
    const calls = mockSupabase('nurse', [{ id: 'r1' }])
    const res = await patch({ is_zsn: true })
    expect(res.status).toBe(403)
    expect(updated(calls)).toBe(false)
  })

  it('@REQ: ADM-RESIDENT-CARD-VISIBILITY - kierownik placówki zmienia ZSN i dostaje potwierdzenie zapisu', async () => {
    const calls = mockSupabase('org_admin', [{ id: 'r1' }])
    const res = await patch({ is_zsn: true })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, is_zsn: true })
    expect(updated(calls)).toBe(true)
  })

  it('@REQ: ADM-RESIDENT-CARD-VISIBILITY - zapis bez zmienionego wiersza to błąd, a nie sukces', async () => {
    mockSupabase('org_admin', [])
    const res = await patch({ is_zsn: false })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.success).toBeUndefined()
    expect(body.error).toMatch(/Nie zapisano/)
  })
})
