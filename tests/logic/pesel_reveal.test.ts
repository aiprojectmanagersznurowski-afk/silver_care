import { describe, it, expect } from 'vitest';
import { maskNationalId, encryptNationalId, decryptNationalId } from '../../apps/web/src/lib/identity_crypto';

describe('PESEL Masking & Encryption Logic (SEC-PESEL-STEP-UP)', () => {
  it('masks PESEL with date prefix and 5 bullets @REQ: SEC-PESEL-HASH', () => {
    expect(maskNationalId('85040112345')).toBe('850401•••••');
    expect(maskNationalId('99123100000')).toBe('991231•••••');
    expect(maskNationalId('invalid')).toBe('•••••••••••');
  });

  it('correctly encrypts and decrypts PESEL via AES-256-GCM @REQ: SEC-PESEL-HASH', () => {
    const rawPesel = '52081212345';
    const encrypted = encryptNationalId(rawPesel);
    expect(encrypted).not.toContain(rawPesel);
    expect(encrypted.split(':')).toHaveLength(3); // iv:tag:ciphertext

    const decrypted = decryptNationalId(encrypted);
    expect(decrypted).toBe(rawPesel);
  });

  it('fails decryption when cipher payload is tampered with @REQ: SEC-PESEL-HASH', () => {
    const rawPesel = '52081212345';
    const encrypted = encryptNationalId(rawPesel);
    const tampered = encrypted.slice(0, -4) + 'abcd';
    expect(() => decryptNationalId(tampered)).toThrow();
  });
});
