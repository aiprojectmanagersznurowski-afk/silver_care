import { beforeEach, expect, it, vi } from 'vitest'
import { processNextVoiceAssignmentPart } from '../../apps/web/src/lib/voice-assignment-worker'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mocks.rpc, storage: { from: mocks.from } }),
}))
vi.mock('@/lib/voice-audio-clip', () => ({
  clipVoiceAudio: async (blob: Blob) => blob,
  VoiceAudioUnavailable: class extends Error {},
}))
vi.mock('@/lib/voice-private-speech', () => ({
  readPrivateSpeech: async () => [{ text: 'Notatka syntetyczna.' }],
}))

const claim = {
  organization_id: 'org', capture_id: 'capture', segment_id: 'split-part', token: 'lease',
  storage_path: 'source', sha256: 'hash', start_ms: 0, end_ms: 1000, author_id: 'user',
  time_certain: true, residents: [],
}
const transcript = 'org/transcripts/capture/split-part/lease'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.from.mockReturnValue({ download: mocks.download, upload: mocks.upload, remove: mocks.remove })
  mocks.download.mockResolvedValue({ data: new Blob(['synthetic audio']) })
  mocks.upload.mockResolvedValue({ error: null })
  mocks.remove.mockResolvedValue({ error: { code: 'TEMPORARY_STORAGE_FAILURE' } })
})

it('zleca trwałe sprzątanie po wygaśnięciu źródła podczas zapisu @REQ: VOICE-RETENTION', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: claim })
    .mockResolvedValueOnce({ data: false })
    .mockResolvedValueOnce({ data: 1 })

  await expect(processNextVoiceAssignmentPart({} as never)).resolves.toBe('idle')
  expect(mocks.rpc).toHaveBeenLastCalledWith('queue_abandoned_voice_transcripts', {
    p_capture_id: claim.capture_id, p_paths: [transcript],
  })
  expect(mocks.remove).not.toHaveBeenCalled()
})

it('zamyka rezerwację przed sprzątaniem zapisu o nieznanym wyniku @REQ: VOICE-RETENTION', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: claim })
    .mockResolvedValueOnce({ error: { code: 'CONNECTION_CLOSED' } })
    .mockResolvedValueOnce({ data: false })
    .mockResolvedValueOnce({ data: 0 })

  await expect(processNextVoiceAssignmentPart({} as never)).resolves.toBe('idle')
  expect(mocks.rpc).toHaveBeenNthCalledWith(3, 'finish_voice_segment_transcription', {
    p_segment_id: claim.segment_id, p_token: claim.token, p_unavailable: false,
  })
  expect(mocks.rpc).toHaveBeenNthCalledWith(4, 'queue_abandoned_voice_transcripts', {
    p_capture_id: claim.capture_id, p_paths: [transcript],
  })
})
