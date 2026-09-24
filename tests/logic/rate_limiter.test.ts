import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkRateLimit, resetRateLimiter } from '../../apps/web/src/lib/rate-limiter'

/**
 * @REQ: SEC-SESSION
 */
describe('API Rate Limiter (@REQ: SEC-SESSION)', () => {
  beforeEach(() => {
    resetRateLimiter()
    vi.useRealTimers()
  })

  it('allows requests within limit', () => {
    const key = 'test-client-1'
    const limit = 5
    const windowMs = 60000

    for (let i = 0; i < limit; i++) {
      const result = checkRateLimit(key, limit, windowMs)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(limit - 1 - i)
    }
  })

  it('blocks requests exceeding limit and returns retryAfterSeconds', () => {
    const key = 'test-client-blocked'
    const limit = 3
    const windowMs = 60000

    // Wykorzystaj limit
    for (let i = 0; i < limit; i++) {
      checkRateLimit(key, limit, windowMs)
    }

    // Kolejne zapytanie powinno zostać zablokowane
    const blockedResult = checkRateLimit(key, limit, windowMs)
    expect(blockedResult.allowed).toBe(false)
    expect(blockedResult.remaining).toBe(0)
    expect(blockedResult.retryAfterSeconds).toBeGreaterThan(0)
    expect(blockedResult.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it('resets window after elapsed time', () => {
    vi.useFakeTimers()
    const key = 'test-client-expiry'
    const limit = 2
    const windowMs = 10000 // 10 sekund

    checkRateLimit(key, limit, windowMs)
    checkRateLimit(key, limit, windowMs)

    const blocked = checkRateLimit(key, limit, windowMs)
    expect(blocked.allowed).toBe(false)

    // Przesuń czas o 11 sekund
    vi.advanceTimersByTime(11000)

    const allowedAgain = checkRateLimit(key, limit, windowMs)
    expect(allowedAgain.allowed).toBe(true)
    expect(allowedAgain.remaining).toBe(1)
  })
})
