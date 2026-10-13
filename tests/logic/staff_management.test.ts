import { describe, it, expect } from 'vitest';
import { validateDeactivationConfirmation, generateTemporaryPassword } from '../../apps/web/src/lib/staff-helpers';

describe('Staff Management Logic (NUR-STAFF-MANAGEMENT)', () => {
  it('requires exact DEZAKTYWUJ confirmation string @REQ: ORG-ISOLATION', () => {
    expect(validateDeactivationConfirmation('DEZAKTYWUJ')).toBe(true);
    expect(validateDeactivationConfirmation(' dezaktywuj ')).toBe(false);
    expect(validateDeactivationConfirmation('USUN')).toBe(false);
    expect(validateDeactivationConfirmation('')).toBe(false);
  });

  it('generates compliant temporary passwords @REQ: SEC-SESSION', () => {
    const tempPass = generateTemporaryPassword();
    expect(tempPass.length).toBeGreaterThanOrEqual(8);
    expect(/[A-Z]/.test(tempPass)).toBe(true);
    expect(/[0-9]/.test(tempPass)).toBe(true);
    expect(/[!@#$%^&*]/.test(tempPass)).toBe(true);
  });

  it('validates missing staffId in reset and suspend actions @REQ: ORG-ISOLATION', async () => {
    const { resetStaffPasswordAction, suspendStaffAction, restoreStaffAction } = await import('../../apps/web/src/actions/staff-management');
    
    const emptyFormData = new FormData();
    const resReset = await resetStaffPasswordAction(emptyFormData);
    expect(resReset.error).toBe('Brak identyfikatora pracownika.');

    const resSuspendMissingId = await suspendStaffAction(emptyFormData);
    expect(resSuspendMissingId.error).toBe('Brak identyfikatora pracownika.');

    const resRestoreMissingId = await restoreStaffAction(emptyFormData);
    expect(resRestoreMissingId.error).toBe('Brak identyfikatora pracownika.');
  });

  it('rejects suspension when confirmation token does not match @REQ: ORG-ISOLATION', async () => {
    const { suspendStaffAction } = await import('../../apps/web/src/actions/staff-management');
    const formData = new FormData();
    formData.append('staffId', 'test-uuid');
    formData.append('confirmation', 'NIEPRAWIDLOWE');

    const res = await suspendStaffAction(formData);
    expect(res.error).toBe('Błędne potwierdzenie. Wpisz dokładnie słowo DEZAKTYWUJ.');
  });
});

