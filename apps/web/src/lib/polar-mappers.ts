/**
 * polar-mappers.ts — Normalizacja i mapowanie danych z Polar AccessLink API
 * Zgodne z:
 * - contracts/integration.contract.mjs (FIELD_MAPPINGS, INGEST_PRECONDITIONS)
 * - ADR-002 (decoupled core) & ADR-005 (MDR presentation boundary)
 */

export interface NormalizedMetricPayload {
  metric: string
  raw_value: string
  dedup_id: string
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
