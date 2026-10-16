import { describe, it, expect } from 'vitest'
import { transcribeWithGroq } from '../../apps/web/src/lib/voice-helpers'

describe('INFRA-GROQ-TRANSCRIPTION — Klient transkrypcji Groq Whisper', () => {
  it('transcribeWithGroq wysyła audio/webm z nagłówkiem Bearer i parametrami modelu @REQ: INFRA-GROQ-TRANSCRIPTION', async () => {
    let capturedUrl = ''
    let capturedAuth = ''
    let capturedBody: FormData | null = null

    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      capturedUrl = String(input)
      capturedAuth = (init?.headers as Record<string, string>)?.['Authorization'] || ''
      capturedBody = init?.body as FormData
      return new Response(JSON.stringify({ text: 'Dzień minął spokojnie.' }), { status: 200 })
    }

    try {
      const audioBlob = new Blob(['sample-webm-bytes'], { type: 'audio/webm' })
      const res = await transcribeWithGroq(audioBlob, 'gsk_valid_test_key')

      expect(res.text).toBe('Dzień minął spokojnie.')
      expect(capturedUrl).toBe('https://api.groq.com/openai/v1/audio/transcriptions')
      expect(capturedAuth).toBe('Bearer gsk_valid_test_key')
      expect(capturedBody).not.toBeNull()

      const file = capturedBody!.get('file') as File
      expect(file).toBeTruthy()
      expect(file.name).toBe('recording.webm')
      expect(capturedBody!.get('model')).toBe('whisper-large-v3')
      expect(capturedBody!.get('language')).toBe('pl')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('transcribeWithGroq obsługuje format iOS Safari audio/mp4 i ustawia właściwe rozszerzenie @REQ: INFRA-GROQ-TRANSCRIPTION', async () => {
    let capturedFilename = ''

    const originalFetch = globalThis.fetch
    globalThis.fetch = async (_input, init) => {
      const body = init?.body as FormData
      const file = body.get('file') as File
      capturedFilename = file?.name || ''
      return new Response(JSON.stringify({ text: 'Notatka nagrana na iPhone.' }), { status: 200 })
    }

    try {
      const audioBlob = new Blob(['fake-mp4-data'], { type: 'audio/mp4' })
      const res = await transcribeWithGroq(audioBlob, 'test-key')

      expect(res.text).toBe('Notatka nagrana na iPhone.')
      expect(capturedFilename).toBe('recording.mp4')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('transcribeWithGroq rzuca błąd gdy brak konfiguracji klucza API @REQ: INFRA-GROQ-TRANSCRIPTION', async () => {
    const audioBlob = new Blob(['audio-data'], { type: 'audio/webm' })
    await expect(transcribeWithGroq(audioBlob, '')).rejects.toThrow('Brak konfiguracji GROQ_API_KEY')
  })

  it('transcribeWithGroq mapuje błąd 401 z Groq na status 502 Bad Gateway @REQ: INFRA-GROQ-TRANSCRIPTION', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ error: { message: 'Invalid API Key provided' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      const audioBlob = new Blob(['audio-data'], { type: 'audio/webm' })
      await expect(transcribeWithGroq(audioBlob, 'invalid-key')).rejects.toMatchObject({
        message: expect.stringContaining('Invalid API Key provided'),
        status: 502,
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('transcribeWithGroq poprawnie propaguje błędy sieciowe @REQ: INFRA-GROQ-TRANSCRIPTION', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => {
      throw new Error('Connection reset by peer')
    }

    try {
      const audioBlob = new Blob(['audio-data'], { type: 'audio/webm' })
      await expect(transcribeWithGroq(audioBlob, 'test-key')).rejects.toThrow('Connection reset by peer')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
