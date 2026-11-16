import { describe, it, expect, vi } from 'vitest'
import { getFamilyResidents } from '../../apps/web/src/lib/family-residents'

/**
 * @REQ: FAM-RESIDENT-DATA-MINIMIZATION
 * @REQ: SEC-NO-PII-LOGS
 *
 * SC-FAM-08: portal rodziny pobiera podopiecznych wyłącznie przez get_family_resident_overview.
 * Błąd RPC to jawny błąd — nigdy ciche przejście na odczyt tabeli residents.
 */
function client(rpcResult: { data: unknown; error: { code: string; message: string } | null }) {
  const from = vi.fn(() => {
    throw new Error('portal rodziny nie może czytać tabel bezpośrednio')
  })
  const rpc = vi.fn(async () => rpcResult)
  return { supabase: { rpc, from } as never, rpc, from }
}

describe('getFamilyResidents (@REQ: FAM-RESIDENT-DATA-MINIMIZATION)', () => {
  it('@REQ: FAM-RESIDENT-DATA-MINIMIZATION - podopieczni wyłącznie z RPC, bez odczytu tabeli', async () => {
    const row = { id: 'r1', first_name: 'Maria', last_name: 'Testowa', avatar_url: null, death_date: null, contract_end_date: null, archived_at: null }
    const c = client({ data: [row], error: null })
    expect(await getFamilyResidents(c.supabase)).toEqual({ status: 'ok', residents: [row] })
    expect(c.rpc).toHaveBeenCalledWith('get_family_resident_overview')
    expect(c.from).not.toHaveBeenCalled()
  })

  it('@REQ: FAM-RESIDENT-DATA-MINIMIZATION - brak powiązań to pusta lista, nie błąd', async () => {
    const c = client({ data: null, error: null })
    expect(await getFamilyResidents(c.supabase)).toEqual({ status: 'ok', residents: [] })
  })

  it('@REQ: SEC-NO-PII-LOGS - błąd RPC jest jawny, bez fallbacku i bez treści błędu w logu', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const c = client({ data: null, error: { code: '42501', message: 'Maria Testowa 90010112345' } })
    expect(await getFamilyResidents(c.supabase)).toEqual({ status: 'error' })
    expect(c.from).not.toHaveBeenCalled()
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/Testowa|90010112345/)
    spy.mockRestore()
  })
})
