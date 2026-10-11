import { describe, it, expect } from 'vitest'
import { MATRIX, CONSENT_GRANTORS, CONSENT_PURPOSES } from '../../contracts/roles.contract.mjs'

/**
 * Testy logiki i uprawnień widoku zgód w portalu rodziny (SC-FAM-02).
 * @REQ: CONSENT-GRANTOR
 * @REQ: CONSENT-LEDGER-IMMUTABLE
 */
describe('Family Consents & GDPR Art. 9 Access (SC-FAM-02)', () => {
  it('enforces MATRIX permissions: legal_guardian can read consent_ledger, but family cannot @REQ: CONSENT-GRANTOR', () => {
    const consentPermission = MATRIX.find((m) => m.resource === 'consent_ledger')
    expect(consentPermission).toBeDefined()
    expect(consentPermission?.read).toContain('legal_guardian:own')
    expect(consentPermission?.read).not.toContain('family:own')
    expect(consentPermission?.read).not.toContain('family')
  })

  it('guarantees that only authorized grantors can grant Art. 9 consents @REQ: CONSENT-GRANTOR', () => {
    expect(CONSENT_GRANTORS).toContain('legal_guardian')
    expect(CONSENT_GRANTORS).toContain('resident_self')
    expect(CONSENT_GRANTORS).not.toContain('family')
  })

  it('validates canonical consent purposes @REQ: CONSENT-LEDGER-IMMUTABLE', () => {
    const purposeIds = CONSENT_PURPOSES.map((p) => p.id)
    expect(purposeIds).toContain('wellness_data_ingest')
    expect(purposeIds).toContain('family_report_access')
  })
})
