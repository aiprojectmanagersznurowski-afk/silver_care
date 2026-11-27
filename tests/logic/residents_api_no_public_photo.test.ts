import { describe, it, expect, vi } from 'vitest'
import { featureSnapshot } from '../helpers/feature-snapshot.test.fixture'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { createClient } from '@/lib/supabase/server'
import { POST } from '../../apps/web/src/app/api/residents/route'

/**
 * @REQ: ADM-RESIDENT-PHOTO
 *
 * SC-ADM-25/AC5: publiczny bucket nie przyjmuje nowych zdjęć podopiecznych — POST /api/residents
 * nie zapisuje adresu zdjęcia przysłanego w treści żądania (zdjęcie dodaje się w oknie „Edytuj”).
 */
describe('POST /api/residents bez publicznego adresu zdjęcia (@REQ: ADM-RESIDENT-PHOTO)', () => {
  it('@REQ: ADM-RESIDENT-PHOTO - avatar_url z żądania nie trafia do bazy', async () => {
    process.env.PESEL_HASH_SALT = process.env.PESEL_HASH_SALT || 'test-salt'
    const inserted: Record<string, unknown>[] = []
    const chain: Record<string, unknown> = {}
    chain.insert = (row: Record<string, unknown>) => { inserted.push(row); return chain }
    chain.select = () => chain
    chain.single = async () => ({ data: { id: 'r1' }, error: null })
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', app_metadata: { role: 'org_admin', organization_id: 'o1' } } }, error: null }),
        getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: 'u1', aal: 'aal2' } } }),
      },
      rpc: async () => featureSnapshot(),
      from: () => chain,
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const req = new NextRequest('http://localhost/api/residents', {
      method: 'POST',
      body: JSON.stringify({ first_name: 'Maria', last_name: 'Testowa', national_id: '52081203447', avatar_url: 'https://example.com/publiczne.png' }),
    })
    const res = await POST(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(200)
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).not.toHaveProperty('avatar_url')
    expect(JSON.stringify(inserted[0])).not.toContain('example.com')
  })
})
