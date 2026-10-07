import { describe, it, expect } from 'vitest'
import {
  isImpersonationSessionActive,
  assertMutationAllowedDuringImpersonation,
  maskResidentListForImpersonation
} from '../../apps/web/src/lib/impersonation-guards'

/**
 * @REQ: SUP-IMPERSONATION
 * @REQ: SEC-NO-PII-LOGS
 *
 * Testy bezpiecznego trybu impersonacji Super Admina (SEC-SUPERADMIN-IMPERSONATION):
 * AC1: Read-Only struktury i blokada PII pensjonariuszy
 * AC2: Blokada mutacji i formularzy (zwraca kod 403)
 * AC3: Blokada eksportu i pobierania danych
 */
describe('Super Admin Impersonation Security Guards (@REQ: SUP-IMPERSONATION, @REQ: SEC-NO-PII-LOGS)', () => {
  describe('AC2: Blokada mutacji w trybie impersonacji', () => {
    it('allows mutations when session is not impersonating', () => {
      const check = assertMutationAllowedDuringImpersonation(false)
      expect(check.allowed).toBe(true)
      expect(check.status).toBeUndefined()
    })

    it('rejects mutations with 403 when session is impersonating', () => {
      const check = assertMutationAllowedDuringImpersonation(true)
      expect(check.allowed).toBe(false)
      expect(check.status).toBe(403)
      expect(check.error).toMatch(/niedozwolona w trybie.*impersonacji/i)
    })
  })

  describe('AC1: Ochrona danych osobowych (PII) podopiecznych', () => {
    const mockResidents = [
      { id: '1', first_name: 'Jan', last_name: 'Kowalski', pesel_hash: 'hash1' },
      { id: '2', first_name: 'Anna', last_name: 'Nowak', pesel_hash: 'hash2' }
    ]

    it('preserves full resident list in normal session', () => {
      const res = maskResidentListForImpersonation(mockResidents, false)
      expect(res.masked).toBe(false)
      expect(res.count).toBe(2)
      expect(res.residents).toHaveLength(2)
      expect(res.residents[0].first_name).toBe('Jan')
    })

    it('masks PII and returns aggregated count only during impersonation', () => {
      const res = maskResidentListForImpersonation(mockResidents, true)
      expect(res.masked).toBe(true)
      expect(res.count).toBe(2)
      expect(res.residents).toHaveLength(0)
    })
  })

  describe('Wykrywanie sesji impersonacji z ciasteczka', () => {
    // SUP-IMPERSONATION: ciasteczko liczy się tylko dla super_admina, który rozpoczął sesję (patrz impersonation_cookie_binding.test.ts)
    const superAdmin = { id: 'sa-1', app_metadata: { role: 'super_admin' } }
    const cookieFor = (impersonatorId: string) => ({
      get: (name: string) =>
        name === 'sc_impersonation'
          ? { value: JSON.stringify({ targetAdminId: 'a-1', targetOrgId: 'org-1', targetOrgName: 'Placówka', adminEmail: '', impersonatorId, startedAt: new Date().toISOString() }) }
          : undefined,
    })

    it('detects active impersonation session when the super admin\'s own cookie is present', () => {
      expect(isImpersonationSessionActive(cookieFor('sa-1'), superAdmin)).toBe(true)
    })

    it('ignores the cookie when no user is signed in or it belongs to someone else', () => {
      expect(isImpersonationSessionActive(cookieFor('sa-1'), null)).toBe(false)
      expect(isImpersonationSessionActive(cookieFor('inny-super-admin'), superAdmin)).toBe(false)
    })

    it('returns false when cookie is absent or empty', () => {
      const mockCookieStore = {
        get: (_name: string) => undefined
      }
      expect(isImpersonationSessionActive(mockCookieStore, superAdmin)).toBe(false)
    })
  })
})
