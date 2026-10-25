import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveCardAccess, sectionsFor, residentSelect } from '../../apps/web/src/lib/resident-card/card-access'
import { getResidentCard } from '../../apps/web/src/lib/resident-card/get-resident-card'

/**
 * @REQ: ADM-RESIDENT-CARD-VISIBILITY
 * @REQ: SEC-PESEL-HASH
 * @REQ: ORG-ISOLATION
 *
 * Warstwa danych wspólnej karty podopiecznego: rola karty wyłącznie z app_metadata, sekcje z kontraktu
 * (RESIDENT_CARD_SECTIONS), jawna lista kolumn bez pesel_hash i bez „*”, a zasoby sekcji niedostępnych
 * dla roli nie są w ogóle odpytywane.
 */

type Call = { table: string; method: string; args: unknown[] }
type Result = { data: unknown; error: { code: string; message: string } | null }

function mockSupabase(results: Partial<Record<string, Result>> = {}) {
  const calls: Call[] = []
  const from = vi.fn((table: string) => {
    const b: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'order', 'limit', 'maybeSingle']) {
      b[method] = (...args: unknown[]) => {
        calls.push({ table, method, args })
        return b
      }
    }
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(results[table] ?? { data: table === 'residents' ? { id: 'r1', first_name: 'Jan', last_name: 'Kowalski' } : [], error: null }).then(res, rej)
    return b
  })
  return { client: { from } as never, calls, from }
}

const user = (appMetadata: Record<string, unknown>, userMetadata: Record<string, unknown> = {}) =>
  ({ id: 'u1', app_metadata: appMetadata, user_metadata: userMetadata }) as never

const selectOf = (calls: Call[], table: string) => String(calls.find((c) => c.table === table && c.method === 'select')?.args[0] ?? '')

describe('resolveCardAccess i sectionsFor (@REQ: ADM-RESIDENT-CARD-VISIBILITY)', () => {
  it('@REQ: ADM-RESIDENT-CARD-VISIBILITY - kierownik i pielęgniarka mają kartę; superadmin tylko w impersonacji i tylko do odczytu', () => {
    expect(resolveCardAccess('org_admin', false)).toEqual({ role: 'org_admin', readOnly: false })
    expect(resolveCardAccess('nurse', false)).toEqual({ role: 'nurse', readOnly: false })
    expect(resolveCardAccess('super_admin', true)).toEqual({ role: 'org_admin', readOnly: true })
    for (const role of ['super_admin', 'family', 'legal_guardian', 'admin', undefined]) {
      expect(resolveCardAccess(role, false), String(role)).toBeNull()
    }
  })

  it('@REQ: ADM-RESIDENT-CARD-VISIBILITY - sekcje pielęgniarki i kierownika zgodne z kontraktem; tryb tylko do odczytu bez sekcji zapisu', () => {
    expect(sectionsFor({ role: 'nurse', readOnly: false })).toEqual(['overview', 'bed', 'wellness', 'daily'])
    expect(sectionsFor({ role: 'org_admin', readOnly: false })).toEqual(['overview', 'bed', 'wellness', 'daily', 'family', 'contract', 'events', 'wearable', 'manage'])
    expect(sectionsFor({ role: 'org_admin', readOnly: true })).not.toContain('manage')
  })

  it('@REQ: SEC-PESEL-HASH - lista kolumn bez pesel_hash i bez „*”, z relacjami tylko dla sekcji roli', () => {
    const nurse = residentSelect(sectionsFor({ role: 'nurse', readOnly: false }))
    const admin = residentSelect(sectionsFor({ role: 'org_admin', readOnly: false }))
    for (const select of [nurse, admin]) {
      expect(select).not.toContain('pesel')
      expect(select).not.toMatch(/(^|[\s,(])\*/)
    }
    expect(nurse).toContain('bed_assignments(')
    for (const hidden of ['resident_relative_links', 'resident_packages', 'resident_events', 'contract_monthly_rate', 'contract_document_path']) {
      expect(nurse, hidden).not.toContain(hidden)
      expect(admin, hidden).toContain(hidden)
    }
  })
})

describe('getResidentCard (@REQ: ADM-RESIDENT-CARD-VISIBILITY, @REQ: ORG-ISOLATION)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('@REQ: ORG-ISOLATION - rodzina, opiekun prawny, konto bez roli i rola z user_metadata: odmowa bez zapytania', async () => {
    for (const u of [user({ role: 'family' }), user({ role: 'legal_guardian' }), user({}), user({}, { role: 'org_admin' })]) {
      const { client, from } = mockSupabase()
      expect((await getResidentCard(client, 'r1', u, false)).status).toBe('forbidden')
      expect(from).not.toHaveBeenCalled()
    }
  })

  it('@REQ: ADM-RESIDENT-CARD-VISIBILITY - pielęgniarka: brak zapytań o opaskę, pakiety, zdarzenia i bliskich', async () => {
    const { client, calls } = mockSupabase()
    const card = await getResidentCard(client, 'r1', user({ role: 'nurse', organization_id: 'o1' }), false)
    expect(card.status).toBe('ok')
    const tables = new Set(calls.map((c) => c.table))
    expect(tables.has('external_wearable_links')).toBe(false)
    expect(selectOf(calls, 'residents')).not.toContain('resident_relative_links')
    expect(tables.has('daily_reports')).toBe(true)
    expect(calls.some((c) => c.table === 'residents' && c.method === 'eq' && c.args[0] === 'organization_id' && c.args[1] === 'o1')).toBe(true)
  })

  it('@REQ: ADM-RESIDENT-CARD-VISIBILITY - kierownik: pełny zestaw, także status opaski', async () => {
    const { client, calls } = mockSupabase()
    const card = await getResidentCard(client, 'r1', user({ role: 'org_admin', organization_id: 'o1' }), false)
    expect(card.status).toBe('ok')
    expect(calls.some((c) => c.table === 'external_wearable_links')).toBe(true)
    expect(selectOf(calls, 'residents')).toContain('resident_events(')
  })

  it('@REQ: ADM-RESIDENT-CARD-VISIBILITY - aktywność i sen: jawny brak danych, bez zapytania o nieistniejącą tabelę', async () => {
    const { client, calls } = mockSupabase()
    const card = await getResidentCard(client, 'r1', user({ role: 'nurse', organization_id: 'o1' }), false)
    expect(card.status === 'ok' && card.wellness).toEqual({ available: false })
    expect(calls.some((c) => c.table === 'wellness_daily')).toBe(false)
  })

  it('@REQ: ORG-ISOLATION - brak podopiecznego to not_found, a błąd bazy to error bez treści błędu', async () => {
    const missing = mockSupabase({ residents: { data: null, error: null } })
    expect((await getResidentCard(missing.client, 'r1', user({ role: 'nurse', organization_id: 'o1' }), false)).status).toBe('not_found')

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = mockSupabase({ residents: { data: null, error: { code: 'XX000', message: 'Jan Kowalski 90010112345' } } })
    const res = await getResidentCard(broken.client, 'r1', user({ role: 'org_admin', organization_id: 'o1' }), false)
    expect(res).toEqual({ status: 'error' })
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/Kowalski|90010112345/)
    spy.mockRestore()
  })
})
