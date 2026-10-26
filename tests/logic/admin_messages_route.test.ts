import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { GET } from '../../apps/web/src/app/api/admin/messages/route'

/**
 * @REQ: FAM-MESSAGES
 *
 * GET /api/admin/messages: odświeżanie dociąga tylko wiadomości nowsze niż `since`;
 * odpowiedź niesie role bliskich (resident_relative_links), żeby skrzynka pokazała, kto pisze.
 */
type Call = { table: string; ops: Array<[string, unknown[]]> }

function mockSupabase(calls: Call[], rows: Record<string, unknown[]>) {
  const from = (table: string) => {
    const call: Call = { table, ops: [] }
    calls.push(call)
    const chain: Record<string, unknown> = {}
    for (const op of ['select', 'order', 'gt', 'in', 'eq', 'limit']) {
      chain[op] = (...args: unknown[]) => { call.ops.push([op, args]); return chain }
    }
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: rows[table] ?? [], error: null })
    return chain
  }
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'a1', app_metadata: { role: 'org_admin' } } }, error: null }) },
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

describe('GET /api/admin/messages (@REQ: FAM-MESSAGES)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('@REQ: FAM-MESSAGES - z parametrem since pobiera tylko nowsze wiadomości', async () => {
    const calls: Call[] = []
    mockSupabase(calls, { family_messages: [] })
    const since = '2026-10-26T10:00:00.000Z'
    const res = await GET(new Request(`http://localhost/api/admin/messages?since=${encodeURIComponent(since)}`))
    expect(res.status).toBe(200)
    const messagesCall = calls.find((c) => c.table === 'family_messages')!
    expect(messagesCall.ops).toContainEqual(['gt', ['created_at', since]])
  })

  it('@REQ: FAM-MESSAGES - zwraca role bliskich dla wątków z odpowiedzi', async () => {
    const calls: Call[] = []
    mockSupabase(calls, {
      family_messages: [{ id: 'm1', resident_id: 'r1', relative_user_id: 'u1', is_from_family: true, content: 'x', created_at: '2026-10-26T08:00:00Z' }],
      resident_relative_links: [{ resident_id: 'r1', relative_user_id: 'u1', role: 'legal_guardian', is_primary_contact: true }],
    })
    const res = await GET(new Request('http://localhost/api/admin/messages'))
    const body = await res.json()
    expect(calls.find((c) => c.table === 'family_messages')!.ops.some(([op]) => op === 'gt')).toBe(false)
    expect(body.relatives).toEqual([{ residentId: 'r1', relativeUserId: 'u1', role: 'legal_guardian', isPrimaryContact: true }])
  })

  it('@REQ: FAM-MESSAGES - nieprawidłowe since to błąd 400, nie pobranie wszystkiego', async () => {
    mockSupabase([], {})
    const res = await GET(new Request('http://localhost/api/admin/messages?since=wczoraj'))
    expect(res.status).toBe(400)
  })
})
