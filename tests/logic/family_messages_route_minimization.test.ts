import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { POST } from '../../apps/web/src/app/api/messages/route'

/**
 * @REQ: FAM-RESIDENT-DATA-MINIMIZATION
 * @REQ: FAM-MESSAGES
 *
 * POST /api/messages (bliski wysyła wiadomość): bez odczytu tabeli residents (SC-FAM-08).
 * Placówka pochodzi z JWT, a podopieczny musi być na liście get_family_resident_overview bliskiego.
 */
type Call = { table: string; method: string; args: unknown[] }

function mockSupabase(overview: { id: string }[]) {
  const calls: Call[] = []
  const from = (table: string) => {
    const chain: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'gte', 'insert', 'single']) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ table, method, args })
        return chain
      }
    }
    chain.then = (resolve: (v: unknown) => void) =>
      resolve(table === 'family_messages' ? { count: 0, data: null, error: null } : { data: { organization_id: 'o1' }, error: null })
    return chain
  }
  const rpc = vi.fn(async () => ({ data: overview, error: null }))
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', app_metadata: { role: 'family', organization_id: 'o1' } } }, error: null }) },
    from,
    rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { calls, rpc }
}

const post = (body: unknown) => POST(new Request('http://localhost/api/messages', { method: 'POST', body: JSON.stringify(body) }))

describe('POST /api/messages bez odczytu residents (@REQ: FAM-RESIDENT-DATA-MINIMIZATION)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('@REQ: FAM-RESIDENT-DATA-MINIMIZATION - wiadomość do powiązanego podopiecznego: placówka z JWT, bez zapytania do residents', async () => {
    const { calls } = mockSupabase([{ id: 'r1' }])
    const res = await post({ resident_id: 'r1', content: 'Dzień dobry' })
    expect(res.status).toBe(201)
    expect(calls.some((c) => c.table === 'residents')).toBe(false)
    const insert = calls.find((c) => c.table === 'family_messages' && c.method === 'insert')
    expect(insert?.args[0]).toMatchObject({ organization_id: 'o1', resident_id: 'r1', relative_user_id: 'u1' })
  })

  it('@REQ: FAM-MESSAGES - podopieczny spoza listy bliskiego: 404 bez zapisu', async () => {
    const { calls } = mockSupabase([{ id: 'r1' }])
    const res = await post({ resident_id: 'r-obcy', content: 'Dzień dobry' })
    expect(res.status).toBe(404)
    expect(calls.some((c) => c.method === 'insert')).toBe(false)
    expect(calls.some((c) => c.table === 'residents')).toBe(false)
  })
})
