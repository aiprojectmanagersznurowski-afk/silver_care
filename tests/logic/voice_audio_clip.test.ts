import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { clipVoiceAudio } from '../../apps/web/src/lib/voice-audio-clip'

function source() {
  const size = 32000 * 2
  const wav = Buffer.alloc(44 + size)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(size + 36, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(16000, 24)
  wav.writeUInt32LE(32000, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(size, 40)
  for (let offset = 0; offset < size; offset += 2) wav.writeInt16LE(offset < size / 2 ? 4000 : -2000, offset + 44)
  return { wav: new Blob([wav], { type: 'audio/wav' }), hash: createHash('sha256').update(wav).digest('hex') }
}

describe('@REQ: VOICE-RESIDENT-ASSIGN wydzielenie audio do prywatnej transkrypcji', () => {
  it('wycina dokładne pozycje w oryginale bez sąsiednich próbek @REQ: VOICE-RESIDENT-ASSIGN', async () => {
    const { wav, hash } = source()
    const result = await clipVoiceAudio(wav, hash, 900, 1100)
    const samples = Buffer.from(await result.arrayBuffer())
    expect(result.type).toBe('audio/wav')
    expect(samples.readUInt32LE(40)).toBe(6400)
    expect(samples.readInt16LE(44)).toBe(4000)
    expect(samples.readInt16LE(44 + 3198)).toBe(4000)
    expect(samples.readInt16LE(44 + 3200)).toBe(-2000)
    expect(samples.readInt16LE(samples.length - 2)).toBe(-2000)
  })

  it('odrzuca uszkodzone źródło i fizycznie niedostępne granice @REQ: VOICE-RESIDENT-ASSIGN', async () => {
    const { wav, hash } = source()
    await expect(clipVoiceAudio(wav, '0'.repeat(64), 100, 200)).rejects.toThrow('VOICE_AUDIO_UNAVAILABLE')
    await expect(clipVoiceAudio(wav, hash, 1900, 2100)).rejects.toThrow('VOICE_AUDIO_UNAVAILABLE')
    await expect(clipVoiceAudio(wav, hash, -100, 200)).rejects.toThrow('VOICE_AUDIO_UNAVAILABLE')
  })
})
