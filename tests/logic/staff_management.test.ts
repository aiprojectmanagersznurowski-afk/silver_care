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
});
