/**
 * rate-limiter.ts — Lekki in-memory sliding window rate limiter
 * Zabezpiecza wrażliwe i kosztowne endpointy przed nadużyciami.
 */

interface RateLimitRecord {
  timestamps: number[]
}

const store = new Map<string, RateLimitRecord>()

// Co 5 minut czyść wygasłe wpisy ze sklepu
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 3600000) // zachowaj wpisy młodsze niż 1h
      if (record.timestamps.length === 0) {
        store.delete(key)
      }
    }
  }, 300000).unref?.()
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

/**
 * Sprawdza, czy zapytanie dla danego identyfikatora (np. IP, user_id) mieści się w limicie.
 * @param key Identyfikator klienta (np. `ip:endpoint`)
 * @param limit Maksymalna dozwolona liczba żądań w oknie
 * @param windowMs Długość okna czasowego w milisekundach
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const windowStart = now - windowMs

  let record = store.get(key)
  if (!record) {
    record = { timestamps: [] }
    store.set(key, record)
  }

  // Odrzuć znaczniki czasu sprzed początku bieżącego okna
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart)

  if (record.timestamps.length >= limit) {
    const oldestInWindow = record.timestamps[0]
    const retryAfterMs = oldestInWindow + windowMs - now
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    }
  }

  // Zarejestruj bieżące żądanie
  record.timestamps.push(now)

  return {
    allowed: true,
    remaining: Math.max(0, limit - record.timestamps.length),
    retryAfterSeconds: 0,
  }
}

/**
 * Czyści stan rate limitera (wykorzystywane w testach jednostkowych).
 */
export function resetRateLimiter(): void {
  store.clear()
}
