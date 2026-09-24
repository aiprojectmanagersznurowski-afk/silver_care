import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildPolarAuthUrl,
  exchangePolarCodeForToken,
  registerPolarUser,
  normalizePolarActivity,
  normalizePolarSleep,
  filterAllowedPolarFields
} from '../../apps/web/src/lib/polar-client'

describe('Polar AccessLink Integration Logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.POLAR_CLIENT_ID = 'test-polar-client-id'
    process.env.POLAR_CLIENT_SECRET = 'test-polar-secret'
    process.env.POLAR_REDIRECT_URI = 'http://localhost:3000/api/polar/callback'
  })

  it('builds valid Polar OAuth authorization URL with state @REQ: INT-CORE-DECOUPLED', () => {
    const url = buildPolarAuthUrl('res-123', 'org-456')
    const parsed = new URL(url)
    expect(parsed.origin).toBe('https://flow.polar.com')
    expect(parsed.pathname).toBe('/oauth2/authorization')
    expect(parsed.searchParams.get('response_type')).toBe('code')
    expect(parsed.searchParams.get('client_id')).toBe('test-polar-client-id')
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/polar/callback')
    expect(parsed.searchParams.get('scope')).toBe('accesslink.read_all')
    
    // State contains encoded residentId and orgId
    const state = JSON.parse(Buffer.from(parsed.searchParams.get('state')!, 'base64').toString('utf-8'))
    expect(state.residentId).toBe('res-123')
    expect(state.orgId).toBe('org-456')
  })

  it('exchanges authorization code for token using Basic Auth header per OAUTH_CONFIG @REQ: INT-CORE-DECOUPLED', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'polar-access-token-xyz',
        token_type: 'bearer',
        expires_in: 7200,
        x_user_id: 12345678
      })
    })
    global.fetch = fetchMock

    const result = await exchangePolarCodeForToken('sample-auth-code')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [endpoint, options] = fetchMock.mock.calls[0]
    expect(endpoint).toBe('https://polarremote.com/v2/oauth2/token')
    expect(options.method).toBe('POST')

    // Basic Auth header check: base64(client_id:client_secret)
    const expectedBasic = Buffer.from('test-polar-client-id:test-polar-secret').toString('base64')
    expect(options.headers['Authorization']).toBe(`Basic ${expectedBasic}`)
    expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded')

    expect(result.accessToken).toBe('polar-access-token-xyz')
    expect(result.xUserId).toBe('12345678')
  })

  it('registers user in Polar AccessLink API @REQ: INT-CORE-DECOUPLED', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ 'member-id': 'res-123' })
    })
    global.fetch = fetchMock

    const success = await registerPolarUser('polar-access-token-xyz', 'res-123')
    expect(success).toBe(true)

    const [endpoint, options] = fetchMock.mock.calls[0]
    expect(endpoint).toBe('https://www.polaraccesslink.com/v3/users')
    expect(options.method).toBe('POST')
    expect(options.headers['Authorization']).toBe('Bearer polar-access-token-xyz')
    expect(JSON.parse(options.body)).toEqual({ 'member-id': 'res-123' })
  })

  it('normalizes daily activity fields with ISO-8601 durations to minutes @REQ: INT-NORMALIZATION', () => {
    const rawActivity = {
      id: 998877,
      date: '2026-09-22',
      'active-steps': 6420,
      calories: 1850,
      duration: 'PT2H30M', // 2h 30m = 150 min
      'active-calories': 620
    }

    const normalized = normalizePolarActivity(rawActivity, '2026-09-22')

    expect(normalized).toEqual([
      { metric: 'steps_total', raw_value: '6420', dedup_id: 'POLAR:2026-09-22:steps_total' },
      { metric: 'active_minutes', raw_value: '150', dedup_id: 'POLAR:2026-09-22:active_minutes' },
      { metric: 'calories_total', raw_value: '1850', dedup_id: 'POLAR:2026-09-22:calories_total' }
    ])
  })

  it('normalizes sleep metrics according to FIELD_MAPPINGS @REQ: INT-NORMALIZATION', () => {
    const rawSleep = {
      date: '2026-09-22',
      sleep_start_time: '2026-09-21T22:30:00+02:00',
      sleep_end_time: '2026-09-22T06:30:00+02:00',
      sleep_score: 82
    }

    const normalized = normalizePolarSleep(rawSleep)

    expect(normalized).toEqual([
      { metric: 'sleep_start_time', raw_value: '2026-09-21T22:30:00+02:00', dedup_id: 'POLAR:2026-09-22:sleep_start_time' },
      { metric: 'sleep_end_time', raw_value: '2026-09-22T06:30:00+02:00', dedup_id: 'POLAR:2026-09-22:sleep_end_time' },
      { metric: 'sleep_duration_min', raw_value: '480', dedup_id: 'POLAR:2026-09-22:sleep_duration_min' },
      { metric: 'sleep_score', raw_value: '82', dedup_id: 'POLAR:2026-09-22:sleep_score' }
    ])
  })

  it('strictly filters out forbidden medical and continuous telemetry (Deny by default) @REQ: INT-INGEST-PRECONDITIONS', () => {
    const untrustedPayload = {
      'active-steps': 5000,
      calories: 2000,
      duration: 'PT1H',
      // Forbidden fields by MDR & Darek contract:
      breathing_rate: 16.5,
      hypnogram: [1, 2, 3, 2, 1],
      heart_rate_samples: [60, 65, 70, 75],
      'first-name': 'Jan',
      'last-name': 'Kowalski'
    }

    const filtered = filterAllowedPolarFields(untrustedPayload)

    expect(filtered).toHaveProperty('active-steps', 5000)
    expect(filtered).toHaveProperty('calories', 2000)
    expect(filtered).toHaveProperty('duration', 'PT1H')

    expect(filtered).not.toHaveProperty('breathing_rate')
    expect(filtered).not.toHaveProperty('hypnogram')
    expect(filtered).not.toHaveProperty('heart_rate_samples')
    expect(filtered).not.toHaveProperty('first-name')
    expect(filtered).not.toHaveProperty('last-name')
  })
})
