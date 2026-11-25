import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findDeclaredVoiceAuthor, readPrivateSpeech, readSpeechConfiguration, redactPrivately } from '../../apps/web/src/lib/voice-private-speech'

const staff = [
  { id: 'a', name: 'Łucja Żak' },
  { id: 'b', name: 'Jan Krawiec' },
]
const payload = { segments: [{ start_ms: 0, end_ms: 800, text: 'Tutaj mówi Łucja Żak.' }] }

beforeEach(() => {
  vi.unstubAllEnvs()
})

describe('Prywatna transkrypcja i deklaracja autora @REQ: VOICE-RESIDENT-ASSIGN', () => {
  it('wymaga jawnej konfiguracji HTTPS, bez danych logowania w URL @REQ: VOICE-RESIDENT-ASSIGN', () => {
    vi.stubEnv('VOICE_PRIVATE_STT_TOKEN', 'fixture')
    for (const url of ['', 'http://remote.test', 'https://worker:pass@remote.test']) {
      vi.stubEnv('VOICE_PRIVATE_STT_URL', url)
      expect(() => readSpeechConfiguration()).toThrow('VOICE_STT_CONFIGURATION')
    }
    vi.stubEnv('VOICE_PRIVATE_STT_URL', 'https://private.test/transcribe')
    expect(readSpeechConfiguration().url.hostname).toBe('private.test')
  })

  it('odrzuca nieprawidłowe granice i przekierowania @REQ: VOICE-RESIDENT-ASSIGN', async () => {
    const config = { url: new URL('https://private.test/transcribe'), token: 'fixture' }
    const audio = new Blob(['fixture'], { type: 'audio/wav' })
    const fetcher = vi.fn(async () => Response.json(payload))
    expect(await readPrivateSpeech(config, audio, fetcher)).toEqual(payload.segments)
    expect(fetcher).toHaveBeenCalledWith(config.url, expect.objectContaining({ redirect: 'error', body: audio }))

    await expect(readPrivateSpeech(config, audio, async () => Response.json({
      segments: [...payload.segments, { start_ms: 200, end_ms: 1200, text: 'Tekst' }],
    }))).rejects.toThrow('VOICE_STT_RESPONSE_INVALID')
  })

  it('przepuszcza treść do dalszej klasyfikacji tylko po redakcji na tej samej prywatnej usłudze @REQ: VOICE-MEDICAL-STRIP', async () => {
    const config = { url: new URL('https://private.test/transcribe'), token: 'fixture' }
    const raw = 'Przykładowy identyfikator testowy w transkrypcji.'
    const provider = vi.fn(async () => Response.json({ redacted_transcript: 'Zakończono śniadanie.' }))
    vi.stubEnv('VOICE_PRIVATE_REDACT_URL', 'https://other.test/redact')
    await expect(redactPrivately(config, raw, provider)).rejects.toThrow('VOICE_REDACTION_CONFIGURATION')
    expect(provider).not.toHaveBeenCalled()

    vi.stubEnv('VOICE_PRIVATE_REDACT_URL', 'https://private.test/redact')
    expect(await redactPrivately(config, raw, provider)).toBe('Zakończono śniadanie.')
    await expect(redactPrivately(config, raw, async () => Response.json({ text: raw })))
      .rejects.toThrow('VOICE_REDACTION_INVALID')
  })

  it('rozpoznaje tylko unikalną jawną deklarację wstępną @REQ: VOICE-RESIDENT-ASSIGN', () => {
    expect(findDeclaredVoiceAuthor(payload.segments[0].text, staff)).toBe('a')
    expect(findDeclaredVoiceAuthor('Widziałem Łucję Żak na korytarzu.', staff)).toBeNull()
    expect(findDeclaredVoiceAuthor('Nazywam się Jan Krawiec.', [...staff, { id: 'c', name: 'Jan Krawiec' }])).toBeNull()
    expect(findDeclaredVoiceAuthor('Mówi Jan Krawiec. Tu Łucja Żak.', staff)).toBeNull()
    expect(findDeclaredVoiceAuthor('Jestem spokojna. Widziałam Jana Krawca.', staff)).toBeNull()
  })
})
