import { describe, it, expect } from 'vitest'
import { generateSecureTemporaryPassword } from '../../apps/web/src/lib/staff-helpers'
import { validatePasswordStrength } from '../../apps/web/src/lib/password'

/**
 * @REQ: SEC-SESSION
 */
describe('Cryptographic Password Security (@REQ: SEC-SESSION)', () => {
  it('generates passwords that strictly satisfy password complexity rules', () => {
    for (let i = 0; i < 50; i++) {
      const pass = generateSecureTemporaryPassword(16)
      expect(pass.length).toBeGreaterThanOrEqual(16)

      const validation = validatePasswordStrength(pass)
      expect(validation.valid).toBe(true)

      // Sprawdź obecność wielkiej litery, małej, cyfry i znaku specjalnego
      expect(/[A-Z]/.test(pass)).toBe(true)
      expect(/[a-z]/.test(pass)).toBe(true)
      expect(/[0-9]/.test(pass)).toBe(true)
      expect(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pass)).toBe(true)
    }
  })

  it('produces unique pseudorandom outputs across invocations', () => {
    const set = new Set<string>()
    for (let i = 0; i < 100; i++) {
      set.add(generateSecureTemporaryPassword(16))
    }
    expect(set.size).toBe(100)
  })
})
