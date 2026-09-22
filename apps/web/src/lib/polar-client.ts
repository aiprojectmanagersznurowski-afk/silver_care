/**
 * polar-client.ts — Klient Polar AccessLink API v3 dla Silver Care
 * Zgodny z:
 * - contracts/integration.contract.mjs (OAUTH_CONFIG, FIELD_MAPPINGS, INGEST_PRECONDITIONS)
 * - ADR-002 (decoupled core) & ADR-005 (MDR presentation boundary)
 */

export interface PolarTokenResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
  xUserId: string
}

export interface NormalizedMetricPayload {
  metric: string
  raw_value: string
  dedup_id: string
}

/**
 * Buduje URL autoryzacji OAuth2 Polar Flow.
 * Przekazuje zaszyfrowany w base64 stan CSRF (residentId, orgId).
 */
export function buildPolarAuthUrl(residentId: string, orgId: string): string {
  const clientId = process.env.POLAR_CLIENT_ID
  const redirectUri = process.env.POLAR_REDIRECT_URI || 'http://localhost:3000/api/polar/callback'

  if (!clientId) {
    throw new Error('Brak konfiguracji POLAR_CLIENT_ID')
  }

  const stateObj = { residentId, orgId, nonce: Math.random().toString(36).substring(2) }
  const state = Buffer.from(JSON.stringify(stateObj)).toString('base64')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'accesslink.read_all',
    state
  })

  return `https://flow.polar.com/oauth2/authorization?${params.toString()}`
}

/**
 * Wymiana kodu autoryzacyjnego na token.
 * KRYTYCZNA UWAGA Z KONTRAKTU (OAUTH_CONFIG):
 * Wymiana kodu na token wymaga nagłówka Authorization: Basic base64(client_id:client_secret),
 * a NIE parametrów w ciele żądania.
 */
export async function exchangePolarCodeForToken(code: string): Promise<PolarTokenResponse> {
  const clientId = process.env.POLAR_CLIENT_ID
  const clientSecret = process.env.POLAR_CLIENT_SECRET
  const redirectUri = process.env.POLAR_REDIRECT_URI || 'http://localhost:3000/api/polar/callback'

  if (!clientId || !clientSecret) {
    throw new Error('Brak konfiguracji POLAR_CLIENT_ID lub POLAR_CLIENT_SECRET')
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const bodyParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri
  })

  const response = await fetch('https://polarremote.com/v2/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: bodyParams.toString()
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Błąd wymiany kodu Polar na token (status ${response.status}): ${errText}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    tokenType: data.token_type || 'bearer',
    expiresIn: data.expires_in,
    xUserId: String(data.x_user_id)
  }
}

/**
 * Rejestracja użytkownika w Polar AccessLink API v3.
 * Wymagany krok po uzyskaniu tokena (POST /v3/users).
 * Status 409 Conflict oznacza, że użytkownik był już zarejestrowany w tej aplikacji i jest traktowany jako sukces.
 */
export async function registerPolarUser(accessToken: string, residentId: string): Promise<boolean> {
  const response = await fetch('https://www.polaraccesslink.com/v3/users', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      'member-id': residentId
    })
  })

  if (response.status === 200 || response.status === 201 || response.status === 409) {
    return true
  }

  const errText = await response.text().catch(() => '')
  throw new Error(`Błąd rejestracji użytkownika Polar (status ${response.status}): ${errText}`)
}

/**
 * Parsuje czas trwania ISO-8601 (np. 'PT2H30M', 'PT15M', 'PT1H') na całkowitą liczbę minut.
 */
export function parseIsoDurationToMinutes(durationStr: string): number {
  if (!durationStr || typeof durationStr !== 'string') return 0
  
  const matches = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i)
  if (!matches) {
    const num = Number(durationStr)
    return isNaN(num) ? 0 : Math.round(num / 60)
  }

  const hours = parseInt(matches[1] || '0', 10)
  const minutes = parseInt(matches[2] || '0', 10)
  const seconds = parseInt(matches[3] || '0', 10)

  return hours * 60 + minutes + Math.round(seconds / 60)
}

/**
 * Normalizuje dobową aktywność do pól kanonicznych FIELD_MAPPINGS:
 * - steps_total
 * - active_minutes (ISO 8601 duration -> minuty)
 * - calories_total
 */
export function normalizePolarActivity(rawActivity: Record<string, unknown>, dateStr: string): NormalizedMetricPayload[] {
  let list: NormalizedMetricPayload[] = []

  const steps = rawActivity['active-steps'] ?? rawActivity['steps'] ?? rawActivity['active_steps']
  if (steps !== undefined && steps !== null) {
    list = [...list, {
      metric: 'steps_total',
      raw_value: String(Math.max(0, Number(steps))),
      dedup_id: `POLAR:${dateStr}:steps_total`
    }]
  }

  const duration = rawActivity['duration']
  if (typeof duration === 'string' && duration.startsWith('PT')) {
    const minutes = parseIsoDurationToMinutes(duration)
    list = [...list, {
      metric: 'active_minutes',
      raw_value: String(minutes),
      dedup_id: `POLAR:${dateStr}:active_minutes`
    }]
  }

  const calories = rawActivity['calories']
  if (calories !== undefined && calories !== null) {
    list = [...list, {
      metric: 'calories_total',
      raw_value: String(Math.max(0, Number(calories))),
      dedup_id: `POLAR:${dateStr}:calories_total`
    }]
  }

  return list
}

/**
 * Normalizuje parametry snu do pól kanonicznych FIELD_MAPPINGS:
 * - sleep_start_time
 * - sleep_end_time
 * - sleep_duration_min
 * - sleep_score
 */
export function normalizePolarSleep(rawSleep: Record<string, unknown>): NormalizedMetricPayload[] {
  let list: NormalizedMetricPayload[] = []
  const dateStr = String(rawSleep['date'] || new Date().toISOString().split('T')[0])

  const startTime = rawSleep['sleep_start_time']
  if (startTime && typeof startTime === 'string') {
    list = [...list, {
      metric: 'sleep_start_time',
      raw_value: startTime,
      dedup_id: `POLAR:${dateStr}:sleep_start_time`
    }]
  }

  const endTime = rawSleep['sleep_end_time']
  if (endTime && typeof endTime === 'string') {
    list = [...list, {
      metric: 'sleep_end_time',
      raw_value: endTime,
      dedup_id: `POLAR:${dateStr}:sleep_end_time`
    }]
  }

  if (startTime && endTime) {
    const startMs = new Date(String(startTime)).getTime()
    const endMs = new Date(String(endTime)).getTime()
    if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
      const durationMin = Math.round((endMs - startMs) / 60000)
      list = [...list, {
        metric: 'sleep_duration_min',
        raw_value: String(durationMin),
        dedup_id: `POLAR:${dateStr}:sleep_duration_min`
      }]
    }
  }

  const sleepScore = rawSleep['sleep_score']
  if (sleepScore !== undefined && sleepScore !== null) {
    list = [...list, {
      metric: 'sleep_score',
      raw_value: String(sleepScore),
      dedup_id: `POLAR:${dateStr}:sleep_score`
    }]
  }

  return list
}

/**
 * Filtruje pola w trybie Deny-by-Default (MDR & RODO):
 * Odrzuca breathing_rate, hypnogram, heart_rate_samples oraz personalia.
 */
export function filterAllowedPolarFields(payload: Record<string, unknown>): Record<string, unknown> {
  const FORBIDDEN_KEYS = new Set([
    'breathing_rate',
    'hypnogram',
    'sleep_cycles',
    'heart_rate_samples',
    'first-name',
    'last-name',
    'first_name',
    'last_name'
  ])

  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (!FORBIDDEN_KEYS.has(key)) {
      clean[key] = value
    }
  }

  return clean
}

/**
 * Pobiera aktywność dobową z Polar AccessLink API: GET /v3/users/activities/{date}
 */
export async function fetchPolarDailyActivity(accessToken: string, dateStr: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://www.polaraccesslink.com/v3/users/activities/${dateStr}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    if (res.status === 404 || res.status === 204) return null
    if (!res.ok) throw new Error(`Polar activity fetch failed: status ${res.status}`)

    const data = await res.json()
    return filterAllowedPolarFields(data)
  } catch {
    return null
  }
}

/**
 * Pobiera sen z Polar AccessLink API: GET /v3/users/sleep/{date}
 */
export async function fetchPolarSleep(accessToken: string, dateStr: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://www.polaraccesslink.com/v3/users/sleep/${dateStr}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    if (res.status === 404 || res.status === 204) return null
    if (!res.ok) throw new Error(`Polar sleep fetch failed: status ${res.status}`)

    const data = await res.json()
    return filterAllowedPolarFields(data)
  } catch {
    return null
  }
}
