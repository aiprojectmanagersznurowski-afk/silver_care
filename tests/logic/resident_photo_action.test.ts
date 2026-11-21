import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * @REQ: ADM-RESIDENT-PHOTO
 * @REQ: SEC-NO-PII-LOGS
 *
 * setResidentPhotoAction: po wgraniu pliku do prywatnego bucketu (RLS storage) kierownik placówki
 * ustawia photo_path podopiecznego. Ścieżka musi wskazywać folder jego placówki i tego podopiecznego;
 * stary plik jest usuwany; audyt bez danych osobowych.
 */
type Call = { target: string; method: string; args: unknown[] }
const state = {
  role: 'org_admin' as string,
  calls: [] as Call[],
  resident: { id: 'r1', organization_id: 'o1', photo_path: 'o1/r1/stare.webp' } as Record<string, unknown> | null,
  exists: true,
}

function chain(target: string, result: () => unknown) {
  const b: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'maybeSingle', 'update', 'insert']) {
    b[method] = (...args: unknown[]) => { state.calls.push({ target, method, args }); return b }
  }
  b.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res)
  return b
}

function client() {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1', app_metadata: { role: state.role, organization_id: 'o1' } } }, error: null })) },
    rpc: vi.fn(async () => ({ data: true, error: null })),
    from: (table: string) => chain(table, () => (table === 'residents' ? { data: state.resident, error: null } : { data: null, error: null })),
    storage: {
      from: (bucket: string) => ({
        list: vi.fn(async (...args: unknown[]) => { state.calls.push({ target: `storage:${bucket}`, method: 'list', args }); return { data: state.exists ? [{ name: 'nowe.webp' }] : [], error: null } }),
        remove: vi.fn(async (...args: unknown[]) => { state.calls.push({ target: `storage:${bucket}`, method: 'remove', args }); return { data: [], error: null } }),
      }),
    },
  }
}

vi.mock('../../apps/web/src/lib/supabase/server', () => ({ createClient: vi.fn(async () => client()) }))
vi.mock('../../apps/web/src/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => client()) }))
vi.mock('../../apps/web/node_modules/next/headers.js', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('../../apps/web/node_modules/next/cache.js', () => ({ revalidatePath: vi.fn() }))

const find = (target: string, method: string) => state.calls.find((c) => c.target === target && c.method === method)

describe('setResidentPhotoAction (@REQ: ADM-RESIDENT-PHOTO)', () => {
  beforeEach(() => {
    state.role = 'org_admin'
    state.calls = []
    state.resident = { id: 'r1', organization_id: 'o1', photo_path: 'o1/r1/stare.webp' }
    state.exists = true
  })

  it('@REQ: ADM-RESIDENT-PHOTO - kierownik ustawia zdjęcie, stary plik usunięty, audyt bez danych osobowych', async () => {
    const { setResidentPhotoAction } = await import('../../apps/web/src/actions/resident-photo')
    const res = await setResidentPhotoAction('r1', 'o1/r1/nowe.webp')
    expect(res).toEqual({ success: true })
    expect(find('residents', 'update')?.args[0]).toEqual({ photo_path: 'o1/r1/nowe.webp' })
    expect(find('storage:resident-photos', 'remove')?.args[0]).toEqual(['o1/r1/stare.webp'])
    expect(find('audit_logs', 'insert')?.args[0]).toEqual({
      organization_id: 'o1',
      performed_by: 'u1',
      action: 'RESIDENT_PHOTO_CHANGED',
      payload: { target_table: 'residents', target_id: 'r1', replaced: true },
    })
  })

  it('@REQ: ADM-RESIDENT-PHOTO - rola inna niż kierownik placówki: odmowa bez zapisu', async () => {
    const { setResidentPhotoAction } = await import('../../apps/web/src/actions/resident-photo')
    for (const role of ['nurse', 'family', 'legal_guardian', 'super_admin']) {
      state.role = role
      expect((await setResidentPhotoAction('r1', 'o1/r1/nowe.webp')).success, role).toBe(false)
    }
    expect(find('residents', 'update')).toBeUndefined()
  })

  it('@REQ: ADM-RESIDENT-PHOTO - ścieżka spoza folderu placówki i podopiecznego albo nieistniejący plik: odmowa', async () => {
    const { setResidentPhotoAction } = await import('../../apps/web/src/actions/resident-photo')
    for (const path of ['o2/r1/nowe.webp', 'o1/r2/nowe.webp', 'o1/r1/../r2/x.webp', 'nowe.webp']) {
      expect((await setResidentPhotoAction('r1', path)).success, path).toBe(false)
    }
    state.exists = false
    expect((await setResidentPhotoAction('r1', 'o1/r1/nowe.webp')).success).toBe(false)
    expect(find('residents', 'update')).toBeUndefined()
  })
})
