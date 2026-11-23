import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clipVoiceAudio } from '../../apps/web/src/lib/voice-audio-clip'
import { processNextVoiceAssignmentPart } from '../../apps/web/src/lib/voice-assignment-worker'

const storage = vi.hoisted(() => ({ download: vi.fn(), upload: vi.fn() }))
const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc, storage: { from: () => storage } }) }))
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

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

it('wysyła do prywatnej transkrypcji wyłącznie bajty wydzielonej części @REQ: VOICE-RESIDENT-ASSIGN', async () => {
  const { wav, hash } = source()
  storage.download.mockResolvedValue({ data: wav })
  storage.upload.mockResolvedValue({ error: null })
  rpc.mockResolvedValueOnce({ data: {
    segment_id: 'child', capture_id: 'capture', organization_id: 'org', storage_path: 'private-original', sha256: hash,
    token: 'lease', start_ms: 1000, end_ms: 1200, time_certain: true, author_id: 'author',
    residents: [{ id: 'resident', firstName: 'Anna', lastName: 'Testowa' }],
  } }).mockResolvedValueOnce({ data: true })
  const fetcher = vi.fn(async (_url: URL, init: RequestInit) => {
    const pcm = Buffer.from(await (init.body as Blob).arrayBuffer())
    expect(pcm.readUInt32LE(40)).toBe(6400)
    expect(pcm.readInt16LE(44)).toBe(-2000)
    return Response.json({ segments: [{ start_ms: 0, end_ms: 190, text: 'Anna Testowa zjadła śniadanie.' }] })
  })
  vi.stubGlobal('fetch', fetcher)
  expect(await processNextVoiceAssignmentPart({ url: new URL('https://stt.example.test'), token: 'fake' }))
    .toBe('processed')
  expect(fetcher).toHaveBeenCalledOnce()
  expect(storage.upload).toHaveBeenCalledWith('org/transcripts/capture/child/lease', expect.any(Blob), expect.any(Object))
  expect(rpc).toHaveBeenLastCalledWith('finish_voice_segment_transcription', expect.objectContaining({
    p_segment_id: 'child', p_token: 'lease',
    p_result: expect.objectContaining({ scope: 'RESIDENT', resident_id: 'resident' }),
  }))
})
