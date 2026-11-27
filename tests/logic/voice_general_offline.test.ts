import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendOfflineVoiceItemToServer } from '../../apps/web/src/lib/voice-offline-queue'

afterEach(() => vi.unstubAllGlobals())

describe('Ogólna notatka w kolejce offline', () => {
  it('ponawia wysyłkę do właściwego endpointu z pierwotnym autorem i czasem @REQ: VOICE-OFFLINE', async () => {
    const post = vi.fn(async (_url: string, _request: RequestInit) => Response.json({ success: true }))
    vi.stubGlobal('fetch', post)
    const createdAt = Date.parse('2026-11-22T13:40:00Z')
    const authorId = 'c0aa5a55-f2c2-4252-9fbe-a7346fc1086c'
    const note = {
      client_uuid: 'capture-id', resident_id: '', audioBlob: new Blob(['voice'], { type: 'audio/webm' }),
      purpose: 'general_note' as const, author_id: authorId, createdAt,
    }
    expect(await sendOfflineVoiceItemToServer(note)).toBe(true)
    const [url, options] = post.mock.calls[0]
    expect(url).toBe('/api/voice/captures')
    const form = options.body as FormData
    expect(form.get('author_id')).toBe(authorId)
    expect(form.get('recorded_at')).toBe(new Date(createdAt).toISOString())
    expect(form.has('resident_id')).toBe(false)
  })
})
