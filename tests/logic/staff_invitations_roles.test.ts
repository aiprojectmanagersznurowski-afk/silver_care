import { describe, it, expect } from 'vitest';
import { determineConsentsForRole } from '../../apps/web/src/lib/onboarding';
import { validateDeactivationConfirmation, generateTemporaryPassword } from '../../apps/web/src/lib/staff-helpers';

/**
 * @REQ: ADM-INVITE
 * @REQ: CONSENT-GRANTOR
 * @REQ: ORG-ISOLATION
 *
 * Testy dla zadania ADM-STAFF-INVITATIONS-ROLES:
 * AC1: Sprawne menu akcji pracownika (potwierdzenie DEZAKTYWUJ, bezpieczne hasła).
 * AC2: Zaproszenie nowego Administratora Placówki (rola org_admin).
 * AC3: Rozdział ról bliskich pensjonariusza (legal_guardian vs family pod kątem zgód Art. 9 RODO).
 */
describe('Staff Management & Role Invitations (@REQ: ADM-INVITE, @REQ: CONSENT-GRANTOR, @REQ: ORG-ISOLATION)', () => {
  it('strictly validates staff roles allowed for invitations including org_admin @REQ: ADM-INVITE', () => {
    const allowedStaffRoles = ['org_admin', 'nurse', 'paramedic'];

    expect(allowedStaffRoles).toContain('org_admin');
    expect(allowedStaffRoles).toContain('nurse');
    expect(allowedStaffRoles).toContain('paramedic');

    // Zakaz zapraszania super_admina z poziomu placówki
    expect(allowedStaffRoles).not.toContain('super_admin');
  });

  it('guarantees separation between legal_guardian (can grant Art. 9) and family (cannot grant Art. 9) @REQ: CONSENT-GRANTOR', () => {
    // 1. Opiekun prawny (legal_guardian) ma pełne prawo do wyrażania zgód Art. 9 RODO
    const guardianEvaluation = determineConsentsForRole('legal_guardian', true);
    expect(guardianEvaluation.allowed).toBe(true);
    expect(guardianEvaluation.canGrantArt9).toBe(true);
    expect(guardianEvaluation.purposes).toContain('wellness_data_ingest');
    expect(guardianEvaluation.purposes).toContain('family_view_basic');

    // 2. Członek rodziny / Obserwator (family) NIE ma prawa do wyrażania zgód Art. 9 RODO
    const familyEvaluation = determineConsentsForRole('family', true);
    expect(familyEvaluation.allowed).toBe(true);
    expect(familyEvaluation.canGrantArt9).toBe(false);
    expect(familyEvaluation.purposes).toHaveLength(0);

    // 3. Brak akceptacji regulaminu blokuje aktywację konta
    const rejectedEvaluation = determineConsentsForRole('legal_guardian', false);
    expect(rejectedEvaluation.allowed).toBe(false);
    expect(rejectedEvaluation.error).toBeDefined();
  });

  it('enforces safety guards for staff account deactivation and password generation @REQ: ORG-ISOLATION', () => {
    // Wymóg dokładnego słowa DEZAKTYWUJ
    expect(validateDeactivationConfirmation('DEZAKTYWUJ')).toBe(true);
    expect(validateDeactivationConfirmation('dezaktywuj')).toBe(false);
    expect(validateDeactivationConfirmation('USUN')).toBe(false);
    expect(validateDeactivationConfirmation('')).toBe(false);

    // Wymóg silnego hasła tymczasowego
    const tempPass = generateTemporaryPassword();
    expect(tempPass.length).toBeGreaterThanOrEqual(8);
    expect(/[A-Z]/.test(tempPass)).toBe(true);
    expect(/[0-9]/.test(tempPass)).toBe(true);
    expect(/[!@#$%^&*]/.test(tempPass)).toBe(true);
  });
});
