export interface PrivateSpeechSegment {
  start_ms: number
  end_ms: number
  text: string
}

export interface VoiceStaffIdentity {
  id: string
  name: string
}

type SpeechConfiguration = { url: URL; token: string }
const maxResponseBytes = 1_048_576

export function readSpeechConfiguration(): SpeechConfiguration {
  const configured = process.env.VOICE_PRIVATE_STT_URL
  const token = process.env.VOICE_PRIVATE_STT_TOKEN
  const url = configured && URL.canParse(configured) ? new URL(configured) : null
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !token) {
    throw new Error('VOICE_STT_CONFIGURATION')
  }
  return { url, token }
}

async function readLimitedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('VOICE_STT_RESPONSE_INVALID')
  const decoder = new TextDecoder()
  let raw = ''
  let size = 0
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      size += chunk.value.byteLength
      if (size > maxResponseBytes) throw new Error('VOICE_STT_RESPONSE_INVALID')
      raw += decoder.decode(chunk.value, { stream: true })
    }
    return JSON.parse(raw + decoder.decode())
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function parseSegments(value: unknown): PrivateSpeechSegment[] {
  const segments = (value as { segments?: unknown } | null)?.segments
  if (!Array.isArray(segments) || segments.length > 250) throw new Error('VOICE_STT_RESPONSE_INVALID')
  let previousEnd = 0
  return segments.map((item) => {
    const { start_ms, end_ms, text } = (item ?? {}) as PrivateSpeechSegment
    if (!Number.isSafeInteger(start_ms) || start_ms < previousEnd || !Number.isSafeInteger(end_ms)
      || end_ms <= start_ms || end_ms > 2_147_483_647 || typeof text !== 'string'
      || !text.trim() || text.length > 12_000) {
      throw new Error('VOICE_STT_RESPONSE_INVALID')
    }
    previousEnd = end_ms
    return { start_ms, end_ms, text: text.trim() }
  })
}

export async function readPrivateSpeech(
  config: SpeechConfiguration, audio: Blob, fetcher: typeof fetch = fetch,
): Promise<PrivateSpeechSegment[]> {
  const response = await fetcher(config.url, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.token}`, 'content-type': audio.type || 'application/octet-stream' },
    body: audio, redirect: 'error', signal: AbortSignal.timeout(90_000), cache: 'no-store',
  }).catch(() => { throw new Error('VOICE_STT_UNAVAILABLE') })
  if (!response.ok) throw new Error('VOICE_STT_UNAVAILABLE')
  const value = await readLimitedJson(response).catch(() => { throw new Error('VOICE_STT_RESPONSE_INVALID') })
  return parseSegments(value)
}

function normalizeName(text: string) {
  return text.toLocaleLowerCase('pl').normalize('NFKD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').trim()
}

export function hasExplicitVoiceIntroduction(text: string) {
  return /^(?:(?:dzien dobry|czesc)[, ]+)?(?:nazywam sie|(?:(?:tutaj|tu) )?mowi)\s+\p{L}/u
    .test(normalizeName(text.slice(0, 400)))
}

export function findDeclaredVoiceAuthor(text: string, staff: readonly VoiceStaffIdentity[]) {
  const statements = normalizeName(text.slice(0, 400)).split(/[.!?;\n]+/)
  const introduction = /^(?:(?:dzien dobry|czesc)[, ]+)?(?:nazywam sie|jestem|(?:(?:tutaj|tu) )?mowi|tu)\s+(.+)$/u
  if (!introduction.test(statements[0]?.trim() ?? '')) return null
  const names = statements.flatMap((statement) => {
    const name = introduction.exec(statement.trim())?.[1]?.split(',', 1)[0].trim()
    return name && /\p{L}+\s+\p{L}+/u.test(name) ? [name] : []
  })
  const identities = new Set(names)
  if (identities.size !== 1) return null
  const matches = staff.filter(({ name }) => identities.has(normalizeName(name)))
  return matches.length === 1 ? matches[0].id : null
}

export function readRedactionUrl(config: SpeechConfiguration) {
  const configured = process.env.VOICE_PRIVATE_REDACT_URL
  const url = configured && URL.canParse(configured) ? new URL(configured) : null
  if (!url || url.origin !== config.url.origin || url.username || url.password || url.search || url.hash
    || url.pathname === config.url.pathname) {
    throw new Error('VOICE_REDACTION_CONFIGURATION')
  }
  return url
}

export async function redactPrivately(config: SpeechConfiguration, raw: string, fetcher: typeof fetch = fetch) {
  const url = readRedactionUrl(config)
  const response = await fetcher(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text: raw }), redirect: 'error', signal: AbortSignal.timeout(25_000), cache: 'no-store',
  }).catch(() => { throw new Error('VOICE_REDACTION_UNAVAILABLE') })
  if (!response.ok) throw new Error('VOICE_REDACTION_UNAVAILABLE')
  const payload = await readLimitedJson(response).catch(() => { throw new Error('VOICE_REDACTION_INVALID') })
  const value = (payload as { redacted_transcript?: unknown } | null)?.redacted_transcript
  if (typeof value !== 'string' || value.length > 12_000) throw new Error('VOICE_REDACTION_INVALID')
  return value
}
