import { describe, it, expect } from 'vitest'
import { resolveRoleDestination, validateAccessibilityStandards } from '../../apps/web/src/lib/ui-theme-validator'
import { ACCESSIBILITY } from '@silvercare/contracts/src/generated/design'
import { evaluateOAuthInviteClaim } from '../../apps/web/src/lib/invite-authorization'

/**
 * @REQ: ADM-INVITE
 * @REQ: UI-ACCESSIBILITY
 *
 * Testy dla zadania ADM-STAFF-CAREGIVER-VISIBILITY (zaktualizowane 2026-10-26: role spoza kontraktu usunięte, decyzja Michała):
 * AC1: Dawne role (caregiver, paramedic, admin, facility_manager) nie są rolami — brak routingu do części personelu ani admina.
 * AC2: Dialog zapraszania pracownika InviteStaffDialog jest poprawnie eksportowanym komponentem.
 * AC3: Bezpieczeństwo ról: konto opiekuna nie może przejąć zaproszenia dla bliskich (fail-closed).
 * AC4: Spełnienie norm kontrastu i dostępności WCAG 2.1 AA.
 */
describe('Staff Caregiver Visibility & Invitation Dialog (@REQ: ADM-INVITE, @REQ: UI-ACCESSIBILITY)', () => {
  it('dawne role spoza kontraktu nie prowadzą do części personelu ani admina @REQ: ADM-INVITE', () => {
    for (const legacy of ['caregiver', 'paramedic', 'admin', 'facility_manager']) {
      expect(resolveRoleDestination(legacy), legacy).toBe('/login?error=unauthorized')
    }
    expect(resolveRoleDestination('nurse')).toBe('/staff')
    expect(resolveRoleDestination('org_admin')).toBe('/admin')
  })

  it('konto personelu (nurse) jest chronione przed nadpisaniem rolą bliskiego @REQ: ADM-INVITE', () => {
    const decision = evaluateOAuthInviteClaim({
      currentUserRole: 'nurse',
      currentUserOrgId: 'org-1111',
      invitationRole: 'family',
      invitationOrgId: 'org-1111',
    })

    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.errorCode).toBe('STAFF_ROLE_CONFLICT')
    }
  })

  it('komponent InviteStaffDialog jest poprawnie zdefiniowany i eksportowany @REQ: ADM-INVITE', async () => {
    const module = await import('../../apps/web/src/components/InviteStaffDialog')
    expect(typeof module.InviteStaffDialog).toBe('function')
  })

  it('standardy dostępności i kontrastu w projekcie spełniają normy WCAG AA @REQ: UI-ACCESSIBILITY', () => {
    const result = validateAccessibilityStandards(ACCESSIBILITY)
    expect(result.valid).toBe(true)
    expect(result.violations).toHaveLength(0)
    expect(ACCESSIBILITY.contrastMinimum).toBeGreaterThanOrEqual(4.5)
  })
})
