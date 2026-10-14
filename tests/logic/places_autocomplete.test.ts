import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { GET } from '../../apps/web/src/app/api/places/autocomplete/route'

describe('Google Places Autocomplete API (@REQ: ORG-PROVISION, @REQ: SEC-SESSION)', () => {
  const originalEnv = process.env.GOOGLE_MAPS_API_KEY
  const originalNextEnv = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_MAPS_API_KEY = 'test-places-key'
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  })

  afterEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = originalEnv
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = originalNextEnv
    vi.restoreAllMocks()
  })

  it('rejects unauthenticated requests with 401 status @REQ: SEC-SESSION', async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({ data: { user: null }, error: new Error('No session') }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const req = new Request('http://localhost:3000/api/places/autocomplete?input=Warszawa')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Brak autoryzacji')
  })

  it('returns empty predictions when input is shorter than 3 characters @REQ: ORG-PROVISION', async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const req = new Request('http://localhost:3000/api/places/autocomplete?input=Wa')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.predictions).toEqual([])
  })

  it('formats and returns Google Places predictions cleanly @REQ: ORG-PROVISION', async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const mockGoogleResponse = {
      status: 'OK',
      predictions: [
        {
          place_id: 'place_123',
          description: 'Marszałkowska 10, Warszawa, Polska',
          structured_formatting: {
            main_text: 'Marszałkowska 10',
            secondary_text: 'Warszawa, Polska'
          }
        }
      ]
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockGoogleResponse
    } as unknown as Response)

    const req = new Request('http://localhost:3000/api/places/autocomplete?input=Warszawa%20Marszalkowska')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.predictions).toHaveLength(1)
    expect(json.predictions[0]).toEqual({
      place_id: 'place_123',
      description: 'Marszałkowska 10, Warszawa, Polska',
      main_text: 'Marszałkowska 10',
      secondary_text: 'Warszawa, Polska'
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const fetchUrl = fetchSpy.mock.calls[0][0] as string
    expect(fetchUrl).toContain('https://maps.googleapis.com/maps/api/place/autocomplete/json')
    expect(fetchUrl).toContain('types=address')
    expect(fetchUrl).toContain('language=pl')
  })

  it('handles missing API key gracefully without crashing @REQ: ORG-PROVISION', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const req = new Request('http://localhost:3000/api/places/autocomplete?input=Krakowska')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.predictions).toEqual([])
    expect(json.warning).toBeDefined()
  })
})
