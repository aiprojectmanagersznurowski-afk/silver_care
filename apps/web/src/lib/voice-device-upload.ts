import { createHash } from 'node:crypto'
import { DEVICE_AUTH, DEVICE_INGEST_PROTOCOL } from '@silvercare/contracts/src/generated/integration'
import { RESIDENT_ASSIGNMENT, VOICE_RETENTION } from '@silvercare/contracts/src/generated/voice'
import { createAdminClient } from '@/lib/supabase/admin'

const protocol = DEVICE_INGEST_PROTOCOL
const maxMetadataBytes = 4096
const { maxAudioBytes } = RESIDENT_ASSIGNMENT.sourceReview
const retryAfterSeconds = 30
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const sessionUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const digest = /^[0-9a-f]{64}$/
const isoTimestamp = /^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/
const clockStates = new Set<string>(protocol.clock.states.map(({ id }) => id))
const codecs = new Set<string>(protocol.codecs)
const steps = {
  INIT: new Set<string>(protocol.wire.requests.find(({ step }) => step === 'INIT')?.body),
  COMMIT: new Set<string>(protocol.wire.requests.find(({ step }) => step === 'COMMIT')?.body),
}

type Step = keyof typeof steps
type Code = typeof protocol.responses[number]['code']
type Admin = ReturnType<typeof createAdminClient>
type PendingUpload = {
  status: 'PENDING'
  attempt_id: string
  path: string
  size_bytes: number
  sha256: string
  expires_at: string
}
type UploadState = PendingUpload | { status: 'DUPLICATE'; sha256: string }
  | { status: 'AUTHENTICATED' | 'DEVICE_REVOKED' | 'HASH_MISMATCH' | 'RETRY_LATER' }

function reply(code: Code, extra: Record<string, string> = {}) {
  const status = protocol.responses.find((response) => response.code === code)!.http
  const retry = code === 'RETRY_LATER' ? { retry_after_s: retryAfterSeconds } : {}
  return Response.json({ code, server_time: new Date().toISOString(), ...retry, ...extra }, {
    status, headers: { 'Cache-Control': 'no-store' },
  })
}

function invalidRequest() {
  return Response.json({ error: 'invalid_request', server_time: new Date().toISOString() }, {
    status: 400, headers: { 'Cache-Control': 'no-store' },
  })
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.body || Number(request.headers.get('content-length')) > maxMetadataBytes) return null
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0
  let json = ''
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      bytes += chunk.value.byteLength
      if (bytes > maxMetadataBytes) {
        await reader.cancel()
        return null
      }
      json += decoder.decode(chunk.value, { stream: true })
    }
    const data: unknown = JSON.parse(json + decoder.decode())
    return data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }
}

function validField(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value)
}

function validInteger(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
}

function readInitMetadata(body: Record<string, unknown>) {
  const { session_id, session_seq, recorded_at, clock_state, age_ms, duration_ms, size_bytes, codec, firmware_version } = body
  if (!validField(session_id, sessionUuid) || !validInteger(session_seq, 1, 2147483647)
    || !validField(recorded_at, isoTimestamp) || !Number.isFinite(Date.parse(recorded_at))
    || typeof clock_state !== 'string' || !clockStates.has(clock_state) || !validInteger(age_ms, 0)
    || (clock_state === 'UNKNOWN' && age_ms !== 0) || !validInteger(duration_ms, 1)
    || !validInteger(size_bytes, 1, maxAudioBytes) || typeof codec !== 'string' || !codecs.has(codec)
    || !validField(firmware_version, /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/)) return null
  return { session_id, session_seq, recorded_at, clock_state, age_ms, size_bytes, codec }
}

async function prepare(admin: Admin, tokenHash: string, captureId?: string, metadata?: NonNullable<ReturnType<typeof readInitMetadata>> & { sha256: string }) {
  const { data, error } = await admin.rpc('prepare_voice_device_upload', {
    p_token_hash: tokenHash, p_capture_id: captureId, p_metadata: metadata ?? null,
  })
  if (error || !data) return { status: 'RETRY_LATER' } as const
  return data as UploadState
}

function signedExpiry(signedUrl: string, maxExpiry: string) {
  const url = new URL(signedUrl)
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null
  // The token came directly from the trusted Storage SDK. Its expiry is used only for the response.
  const claims = url.searchParams.get('token')?.split('.')[1]
  if (!claims) return null
  const { exp } = JSON.parse(Buffer.from(claims, 'base64url').toString('utf8'))
  if (!validInteger(exp, 1)) return null
  const expires = exp * 1000
  const limit = Date.parse(maxExpiry)
  return expires > Date.now() && Number.isFinite(limit) && expires <= limit - 60_000
    ? new Date(expires).toISOString()
    : null
}

async function sign(admin: Admin, upload: PendingUpload) {
  const { data, error } = await admin.storage.from(VOICE_RETENTION.storageBucket)
    .createSignedUploadUrl(upload.path, { upsert: false })
  if (error || !data?.signedUrl) return reply('RETRY_LATER')
  const uploadExpiresAt = signedExpiry(data.signedUrl, upload.expires_at)
  return uploadExpiresAt
    ? reply('UPLOAD_URL', { upload_url: data.signedUrl, upload_expires_at: uploadExpiresAt })
    : reply('RETRY_LATER')
}

async function matchesUpload(stream: ReadableStream<Uint8Array>, upload: PendingUpload) {
  const reader = stream.getReader()
  const sha256 = createHash('sha256')
  let size = 0
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      size += chunk.value.byteLength
      if (size > upload.size_bytes || size > maxAudioBytes) {
        await reader.cancel()
        return false
      }
      sha256.update(chunk.value)
    }
    return size === upload.size_bytes && sha256.digest('hex') === upload.sha256
  } finally {
    reader.releaseLock()
  }
}

async function commit(admin: Admin, tokenHash: string, captureId: string, sha256: string, upload: PendingUpload) {
  if (upload.sha256 !== sha256) return reply('HASH_MISMATCH')
  const { data: stream, error } = await admin.storage.from(VOICE_RETENTION.storageBucket).download(upload.path).asStream()
  if (error) {
    const status = 'statusCode' in error ? String(error.statusCode) : ''
    return reply(status === '404' ? 'HASH_MISMATCH' : 'RETRY_LATER')
  }
  if (!stream || !await matchesUpload(stream, upload)) return reply('HASH_MISMATCH')

  const result = await admin.rpc('commit_voice_device_upload', {
    p_token_hash: tokenHash, p_capture_id: captureId, p_attempt_id: upload.attempt_id, p_sha256: sha256,
  })
  switch (result.data) {
    case 'ACCEPTED': case 'DUPLICATE': case 'DEVICE_REVOKED': case 'HASH_MISMATCH':
      return reply(result.data)
    default:
      return reply('RETRY_LATER')
  }
}

// @REQ: VOICE-DEVICE-INGEST
export async function handleVoiceDeviceUpload(request: Request, step: Step) {
  const token = request.headers.get(DEVICE_AUTH.header)
  if (!validField(token, /^[!-~]{1,256}$/)) return reply('DEVICE_REVOKED')
  try {
    const body = await readJson(request)
    const admin = createAdminClient()
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const forbidden = body && protocol.fields.forbidden.some((field) => Object.hasOwn(body, field))
    const allowed = body && Object.keys(body).length === steps[step].size
      && Object.keys(body).every((key) => steps[step].has(key))
    const metadata = body && step === 'INIT' ? readInitMetadata(body) : null
    const captureId = body?.client_capture_id
    const sha256 = body?.sha256
    if (!allowed || !validField(captureId, uuid) || !validField(sha256, digest) || (step === 'INIT' && !metadata)) {
      const state = await prepare(admin, tokenHash)
      if (state.status === 'DEVICE_REVOKED' || state.status === 'RETRY_LATER') return reply(state.status)
      return forbidden && step === 'INIT' ? reply('FORBIDDEN_FIELD') : invalidRequest()
    }

    const state = await prepare(admin, tokenHash, captureId, metadata ? { ...metadata, sha256 } : undefined)
    if (state.status === 'DEVICE_REVOKED' || state.status === 'RETRY_LATER') return reply(state.status)
    if (state.status === 'DUPLICATE') return reply(state.sha256 === sha256 ? 'DUPLICATE'
      : step === 'COMMIT' ? 'HASH_MISMATCH' : 'RETRY_LATER')
    if (state.status === 'HASH_MISMATCH' && step === 'COMMIT') return reply('HASH_MISMATCH')
    if (state.status !== 'PENDING') return reply('RETRY_LATER')
    return step === 'INIT' ? await sign(admin, state) : await commit(admin, tokenHash, captureId, sha256, state)
  } catch {
    return reply('RETRY_LATER')
  }
}
