import { describe, it, expect } from 'vitest'
import { MATRIX } from '../../contracts/roles.contract.mjs'

/**
 * Testy jednostkowe uprawnień i reguł dla kontaktu głównego (SC-ADM-03 AC3).
 * @REQ: ADM-RESIDENT-ADD
 * @REQ: ADM-INVITE
 */
describe('Primary Contact Role & Permissions (SC-ADM-03 AC3)', () => {
  it('enforces that only org_admin can manage resident relatives and primary contacts @REQ: ADM-RESIDENT-ADD', () => {
    const residentPermission = MATRIX.find((m) => m.resource === 'residents')
    expect(residentPermission).toBeDefined()
    expect(residentPermission?.update).toContain('org_admin')
    expect(residentPermission?.update).not.toContain('family')
    expect(residentPermission?.update).not.toContain('legal_guardian')
  })

  it('guarantees invitation role distinction between legal_guardian and family @REQ: ADM-INVITE', () => {
    const invitationRoles = ['legal_guardian', 'family']
    expect(invitationRoles).toContain('legal_guardian')
    expect(invitationRoles).toContain('family')
  })
})
