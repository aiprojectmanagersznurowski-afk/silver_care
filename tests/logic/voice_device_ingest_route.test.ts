import { createHash } from 'node:crypto'
import { beforeEach, expect, it, vi } from 'vitest'
import { DEVICE_AUTH, DEVICE_INGEST_PROTOCOL } from '@silvercare/contracts/src/generated/integration'
import { VOICE_RETENTION } from '@silvercare/contracts/src/generated/voice'
import { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { POST as init } from '../../apps/web/src/app/api/voice/device/route'
import { POST as commit } from '../../apps/web/src/app/api/voice/device/commit/route'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), bucket: vi.fn(), sign: vi.fn(), download: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => { throw new Error('Zbędna sesja użytkownika') } }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({
  rpc: mocks.rpc,
  storage: { from: mocks.bucket },
}) }))

const capture = '5a847229-2931-4aba-8e89-4f4ed926b1ec'
const attempt = '66adbb46-69a6-42ea-9587-9109bf5eac18'
const token = 'synthetic-device-token'
const audio = Buffer.from('OggS synthetic audio')
const sha256 = createHash('sha256').update(audio).digest('hex')
const metadata = {
  client_capture_id: capture, session_id: 'fc0427e8-9839-4492-bcc6-ceda2f278ea3', session_seq: 2,
  recorded_at: '2026-11-25T06:00:00.000Z', clock_state: 'RELATIVE', age_ms: 12345,
  duration_ms: 1000, sha256, size_bytes: audio.length, codec: 'OPUS', firmware_version: '0.1.0',
}
const path = `org/device/device/${capture}/${attempt}`
const req = (step: 'INIT' | 'COMMIT', data: object, secret = token) => new Request(
  'https://app.test' + DEVICE_INGEST_PROTOCOL.wire.requests.find((item) => item.step === step)!.path,
  { method: 'POST', headers: { [DEVICE_AUTH.header]: secret }, body: JSON.stringify(data) },
)
const commitBody = { client_capture_id: capture, sha256 }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.bucket.mockReturnValue({ createSignedUploadUrl: mocks.sign, download: mocks.download })
  mocks.download.mockResolvedValue({ data: new Blob([new Uint8Array(audio)], { type: 'audio/ogg' }) })
  mocks.rpc.mockResolvedValue({ data: {
    status: 'PENDING', attempt_id: attempt, path, sha256, size_bytes: audio.length, codec: 'OPUS',
    expires_at: new Date(Date.now() + 2.5 * 3600000).toISOString(),
  } })
})

it('przepuszcza wyłącznie trasy urządzenia bez sesji użytkownika @REQ: VOICE-DEVICE-INGEST', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://storage.test')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'synthetic-key')
  try {
    for (const { path } of DEVICE_INGEST_PROTOCOL.wire.requests) {
      const request = new NextRequest('https://app.test' + path, { method: 'POST' })
      expect((await updateSession(request)).headers.get('x-middleware-next')).toBe('1')
    }
    await expect(updateSession(new NextRequest('https://app.test/api/voice/devices'))).rejects.toThrow('Zbędna sesja')
  } finally {
    vi.unstubAllEnvs()
  }
})

it('podpisuje zapis bez nadpisywania i zwraca prawdziwy czas wygaśnięcia @REQ: VOICE-DEVICE-INGEST', async () => {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url')
  const signedUrl = `https://storage.test/upload?token=header.${payload}.signature`
  mocks.sign.mockResolvedValue({ data: { signedUrl } })
  const response = await init(req('INIT', metadata))
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    code: 'UPLOAD_URL', upload_url: signedUrl, upload_expires_at: new Date(exp * 1000).toISOString(),
    server_time: expect.stringMatching(/^\d{4}-.*\.\d{3}Z$/),
  })
  expect(mocks.bucket).toHaveBeenCalledWith(VOICE_RETENTION.storageBucket)
  expect(mocks.sign).toHaveBeenCalledWith(path, { upsert: false })
  expect(mocks.rpc).toHaveBeenCalledWith('prepare_voice_device_upload', {
    p_token_hash: createHash('sha256').update(token).digest('hex'), p_capture_id: capture,
    p_metadata: expect.objectContaining({ session_id: metadata.session_id, age_ms: metadata.age_ms }),
  })
})

it('blokuje pola osobowe, nieważny token i metadane innej placówki @REQ: VOICE-DEVICE-INGEST', async () => {
  expect(await (await init(req('INIT', { ...metadata, resident_id: capture }))).json()).toMatchObject({ code: 'FORBIDDEN_FIELD' })
  expect((await init(req('INIT', { ...metadata, organization_id: capture }))).status).toBe(400)
  mocks.rpc.mockResolvedValue({ data: { status: 'DEVICE_REVOKED' } })
  expect((await init(req('INIT', metadata))).status).toBe(401)
  expect((await commit(req('COMMIT', commitBody))).status).toBe(401)
  expect(mocks.sign).not.toHaveBeenCalled()
  expect(mocks.download).not.toHaveBeenCalled()
})

it('weryfikuje bajty przed rejestracją i nie powtarza zapisu po utracie ACK @REQ: VOICE-DEVICE-INGEST', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: { status: 'PENDING', attempt_id: attempt, path, sha256, size_bytes: audio.length, codec: 'OPUS' } })
    .mockResolvedValueOnce({ data: 'ACCEPTED' })
    .mockResolvedValueOnce({ data: { status: 'DUPLICATE', sha256 } })
  expect(await (await commit(req('COMMIT', commitBody))).json()).toMatchObject({ code: 'ACCEPTED' })
  expect(await (await commit(req('COMMIT', commitBody))).json()).toMatchObject({ code: 'DUPLICATE' })
  expect(mocks.download).toHaveBeenCalledTimes(1)
  expect(mocks.rpc.mock.calls.filter(([name]) => name === 'commit_voice_device_upload')).toHaveLength(1)
})

it('odrzuca plik o błędnym rozmiarze albo skrócie bez rejestracji nagrania @REQ: VOICE-DEVICE-INGEST', async () => {
  mocks.download.mockResolvedValueOnce({ data: new Blob(['short']) })
    .mockResolvedValueOnce({ data: new Blob([new Uint8Array(audio.length)]) })
  for (let i = 0; i < 2; i++) {
    expect(await (await commit(req('COMMIT', commitBody))).json()).toMatchObject({ code: 'HASH_MISMATCH' })
  }
  expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(['prepare_voice_device_upload', 'prepare_voice_device_upload'])
})
