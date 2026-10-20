/**
 * polar-client.ts — Klient Polar AccessLink API v3 dla Silver Care
 * Zgodny z:
 * - contracts/integration.contract.mjs (OAUTH_CONFIG, FIELD_MAPPINGS, INGEST_PRECONDITIONS)
 * - ADR-002 (decoupled core) & ADR-005 (MDR presentation boundary)
 */

import {
  NormalizedMetricPayload,
  filterAllowedPolarFields,
} from './polar-mappers'

export type { NormalizedMetricPayload }
export {
  parseIsoDurationToMinutes,
  normalizePolarActivity,
  normalizePolarSleep,
  filterAllowedPolarFields,
} from './polar-mappers'

export interface PolarTokenResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
  xUserId: string
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
