import { describe, it, expect } from 'vitest'
import { resolveRoleDestination, validateAccessibilityStandards } from '../../apps/web/src/lib/ui-theme-validator'
import { ACCESSIBILITY } from '@silvercare/contracts/src/generated/design'
import { evaluateOAuthInviteClaim } from '../../apps/web/src/lib/invite-authorization'

/**
 * @REQ: ADM-INVITE
 * @REQ: UI-ACCESSIBILITY
 *
 * Testy dla zadania ADM-STAFF-CAREGIVER-VISIBILITY:
 * AC1: Rola caregiver jest pełnoprawną rolą personelu z routingiem do /staff.
 * AC2: Dialog zapraszania pracownika InviteStaffDialog jest poprawnie eksportowanym komponentem.
 * AC3: Bezpieczeństwo ról: konto opiekuna nie może przejąć zaproszenia dla bliskich (fail-closed).
 * AC4: Spełnienie norm kontrastu i dostępności WCAG 2.1 AA.
 */
describe('Staff Caregiver Visibility & Invitation Dialog (@REQ: ADM-INVITE, @REQ: UI-ACCESSIBILITY)', () => {
  it('rola caregiver jest mapowana do widoku personelu (/staff) w systemie routingu @REQ: ADM-INVITE', () => {
    const destination = resolveRoleDestination('caregiver')
    expect(destination).toBe('/staff')
  })

  it('konto personelu z rolą caregiver jest chronione przed nadpisaniem rolą bliskiego @REQ: ADM-INVITE', () => {
    const decision = evaluateOAuthInviteClaim({
      currentUserRole: 'caregiver',
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
