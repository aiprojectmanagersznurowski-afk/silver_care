import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  detectSupportedAudioFormat,
  getExtensionFromMimeType,
  transcribeWithGroq,
} from '../../apps/web/src/lib/voice-helpers'

describe('VOICE-NOTE-RECORDING-FINISH & Transkrypcja STT', () => {
  const originalWindow = globalThis.window
  const originalMediaRecorder = (globalThis as unknown as Record<string, unknown>).MediaRecorder

  afterEach(() => {
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow
    } else {
      delete (globalThis as unknown as Record<string, unknown>).window
    }
    if (originalMediaRecorder !== undefined) {
      ;(globalThis as unknown as Record<string, unknown>).MediaRecorder = originalMediaRecorder
    } else {
      delete (globalThis as unknown as Record<string, unknown>).MediaRecorder
    }
  })

  it('detectSupportedAudioFormat wybiera audio/webm dla Chrome i Android @REQ: VOICE-ZERO-GUESSING', () => {
    ;(globalThis as unknown as Record<string, unknown>).window = {}
    ;(globalThis as unknown as Record<string, unknown>).MediaRecorder = {
      isTypeSupported: (type: string) => type.includes('audio/webm'),
    }

    const format = detectSupportedAudioFormat()
    expect(format.mimeType).toBe('audio/webm;codecs=opus')
    expect(format.ext).toBe('webm')
  })

  it('detectSupportedAudioFormat wybiera audio/mp4 dla iOS Safari WebKit @REQ: VOICE-ZERO-GUESSING', () => {
    ;(globalThis as unknown as Record<string, unknown>).window = {}
    ;(globalThis as unknown as Record<string, unknown>).MediaRecorder = {
      isTypeSupported: (type: string) => type === 'audio/mp4',
    }

    const format = detectSupportedAudioFormat()
    expect(format.mimeType).toBe('audio/mp4')
    expect(format.ext).toBe('mp4')
  })

  it('detectSupportedAudioFormat zwraca bezpieczny fallback gdy brak MediaRecorder @REQ: VOICE-ZERO-GUESSING', () => {
    delete (globalThis as unknown as Record<string, unknown>).MediaRecorder
    const format = detectSupportedAudioFormat()
    expect(format.mimeType).toBe('')
    expect(format.ext).toBe('webm')
  })

  it('getExtensionFromMimeType poprawnie mapuje formaty iOS oraz przeglądarek desktop @REQ: INFRA-GROQ-TRANSCRIPTION', () => {
    expect(getExtensionFromMimeType('audio/mp4')).toBe('mp4')
    expect(getExtensionFromMimeType('audio/mp4;codecs=mp4a.40.2')).toBe('mp4')
    expect(getExtensionFromMimeType('audio/m4a')).toBe('m4a')
    expect(getExtensionFromMimeType('audio/aac')).toBe('m4a')
    expect(getExtensionFromMimeType('audio/webm;codecs=opus')).toBe('webm')
    expect(getExtensionFromMimeType('audio/ogg;codecs=opus')).toBe('ogg')
    expect(getExtensionFromMimeType('audio/wav')).toBe('wav')
  })

  it('walidacja pustego pliku audio rzuca błąd przed wysłaniem do zewnętrznego API @REQ: INFRA-GROQ-TRANSCRIPTION', async () => {
    const emptyBlob = new Blob([], { type: 'audio/webm' })
    await expect(transcribeWithGroq(emptyBlob, 'dummy-groq-key')).rejects.toThrow(
      'Brak pliku dźwiękowego lub nagranie jest puste'
    )
  })

  it('odpowiedź transkrypcji z Groq jest poprawnie przycinana i zwracana w polu text @REQ: VOICE-ZERO-GUESSING', async () => {
    const mockBlob = new Blob(['sample-audio-bytes'], { type: 'audio/mp4' })
    const originalFetch = globalThis.fetch

    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ text: '  Senior zjadł obiad i wyszedł na spacer.  ' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      const res = await transcribeWithGroq(mockBlob, 'test-key')
      expect(res.text).toBe('Senior zjadł obiad i wyszedł na spacer.')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
