import { describe, it, expect } from 'vitest';
import { validatePasswordStrength } from '../../apps/web/src/lib/password';

describe('Profile Security & Password Policy (NUR-PROFILE-SECURITY)', () => {
  it('rejects short passwords @REQ: SEC-SESSION', () => {
    const res = validatePasswordStrength('Short1!');
    expect(res.valid).toBe(false);
    expect(res.message).toMatch(/co najmniej 8 znaków/);
  });

  it('rejects passwords without uppercase letter @REQ: SEC-SESSION', () => {
    const res = validatePasswordStrength('password123!');
    expect(res.valid).toBe(false);
    expect(res.message).toMatch(/wielką literę/);
  });

  it('rejects passwords without numbers @REQ: SEC-SESSION', () => {
    const res = validatePasswordStrength('PasswordSecure!');
    expect(res.valid).toBe(false);
    expect(res.message).toMatch(/cyfrę/);
  });

  it('rejects passwords without special characters @REQ: SEC-SESSION', () => {
    const res = validatePasswordStrength('PasswordSecure123');
    expect(res.valid).toBe(false);
    expect(res.message).toMatch(/znak specjalny/);
  });

  it('accepts strong compliant passwords @REQ: SEC-SESSION', () => {
    const res = validatePasswordStrength('SilverCare2026!#');
    expect(res.valid).toBe(true);
  });
});
