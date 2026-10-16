import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterSeconds: 0 }),
}))

import { createClient } from '@/lib/supabase/server'
import { POST } from '../../apps/web/src/app/api/voice/transcribe/route'

/**
 * @REQ: VOICE-DRAFT-ISOLATION
 * @REQ: VOICE-ZERO-GUESSING
 * @REQ: VOICE-FOLLOWUP
 * @REQ: VOICE-OFFLINE
 *
 * Test kontraktu endpointu /api/voice/transcribe dla 3 kształtów żądania:
 * 1. Z resident_id -> notatka o podopiecznym (tworzy nowy szkic w voice_draft_notes).
 * 2. Bez resident_id -> wiadomość na czacie / import placówki (czysta transkrypcja bez tworzenia rekordu).
 * 3. Z draft_id i client_uuid -> uzupełnienie istniejącego szkicu / deduplikacja offline.
 */

describe('Kontrakt endpointu /api/voice/transcribe (3 kształty żądania)', () => {
  const originalEnvKey = process.env.GROQ_API_KEY
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GROQ_API_KEY = 'test-groq-api-key'

    // Mock fetch dla zewnętrznego Groq Whisper STT API
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: 'Senior zjadł pełny obiad i odpoczywał w ogrodzie.' }),
    } as Response)
  })

  afterEach(() => {
    process.env.GROQ_API_KEY = originalEnvKey
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('Kształt 1: żądanie z resident_id tworzy nowy szkic w voice_draft_notes i zwraca draftId @REQ: VOICE-DRAFT-ISOLATION', async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'draft-uuid-new-123' }, error: null }),
      }),
    })

    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'nurse-uuid-456' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'voice_draft_notes') {
          return { insert: mockInsert }
        }
        return {}
      }),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const formData = new FormData()
    formData.append('file', new Blob(['fake-audio-bytes'], { type: 'audio/webm' }), 'recording.webm')
    formData.append('resident_id', 'resident-uuid-789')
    formData.append('client_uuid', 'client-offline-uuid-111')

    const req = new Request('http://localhost:3000/api/voice/transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-jwt-token' },
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.draftId).toBe('draft-uuid-new-123')
    expect(json.text).toBe('Senior zjadł pełny obiad i odpoczywał w ogrodzie.')
    expect(json.transcript).toBe('Senior zjadł pełny obiad i odpoczywał w ogrodzie.')
    expect(json.newChunk).toBe('Senior zjadł pełny obiad i odpoczywał w ogrodzie.')

    // Weryfikacja zapisu do bazy z resident_id, nurse_id i client_uuid
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        resident_id: 'resident-uuid-789',
        nurse_id: 'nurse-uuid-456',
        transcript: 'Senior zjadł pełny obiad i odpoczywał w ogrodzie.',
        client_uuid: 'client-offline-uuid-111',
      })
    )
  })

  it('Kształt 2: żądanie bez resident_id zwraca czysty transkrypt bez tworzenia rekordu szkicu @REQ: VOICE-ZERO-GUESSING', async () => {
    const mockFrom = vi.fn()

    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'nurse-uuid-456' } }, error: null }),
      },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const formData = new FormData()
    formData.append('file', new Blob(['fake-audio-bytes'], { type: 'audio/mp4' }), 'message.mp4')
    formData.append('purpose', 'staff_message')
    // brak resident_id!

    const req = new Request('http://localhost:3000/api/voice/transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-jwt-token' },
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.text).toBe('Senior zjadł pełny obiad i odpoczywał w ogrodzie.')
    expect(json.transcript).toBe('Senior zjadł pełny obiad i odpoczywał w ogrodzie.')
    expect(json.draftId).toBeUndefined()

    // Baza nie może być dotykana dla czatu personelu
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('Kształt 3: żądanie z draft_id pobiera stary transkrypt, dopisuje uzupełnienie i aktualizuje szkic @REQ: VOICE-FOLLOWUP @REQ: VOICE-OFFLINE', async () => {
    const existingDraftText = 'Senior zjadł śniadanie o 08:30.'
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { transcript: existingDraftText }, error: null }),
      }),
    })

    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'nurse-uuid-456' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'voice_draft_notes') {
          return {
            select: mockSelect,
            update: mockUpdate,
          }
        }
        return {}
      }),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const formData = new FormData()
    formData.append('file', new Blob(['fake-audio-bytes'], { type: 'audio/webm' }), 'followup.webm')
    formData.append('resident_id', 'resident-uuid-789')
    formData.append('draft_id', 'existing-draft-999')
    formData.append('client_uuid', 'client-offline-uuid-222')

    const req = new Request('http://localhost:3000/api/voice/transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-jwt-token' },
      body: formData,
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.draftId).toBe('existing-draft-999')
    expect(json.newChunk).toBe('Senior zjadł pełny obiad i odpoczywał w ogrodzie.')
    expect(json.text).toContain('Senior zjadł śniadanie o 08:30.')
    expect(json.text).toContain('[UZUPEŁNIENIE:] Senior zjadł pełny obiad i odpoczywał w ogrodzie.')

    // Weryfikacja aktualizacji istniejącego rekordu
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: `${existingDraftText}\n\n[UZUPEŁNIENIE:] Senior zjadł pełny obiad i odpoczywał w ogrodzie.`,
        status: 'DRAFT',
        followup_question: null,
      })
    )
  })
})
