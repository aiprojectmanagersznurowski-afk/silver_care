import { describe, it, expect } from 'vitest';
import { 
  validateInvitationState, 
  maskEmail, 
  determineConsentsForRole,
  type InvitationRecord 
} from '../../apps/web/src/lib/onboarding';

describe('FAM-ONBOARDING Logic', () => {
  const baseInvitation: InvitationRecord = {
    id: '11111111-1111-1111-1111-111111111111',
    organization_id: '22222222-2222-2222-2222-222222222222',
    resident_id: '33333333-3333-3333-3333-333333333333',
    role: 'family',
    email: 'janina.kowalska@example.com',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    revoked_at: null,
    claimed_at: null,
  };

  it('rejects missing or empty token @REQ: FAM-ONBOARDING', () => {
    const resultNull = validateInvitationState(null);
    expect(resultNull.valid).toBe(false);
    expect(resultNull.status).toBe('MISSING_TOKEN');
    expect(resultNull.message).toMatch(/Brak tokena/i);

    const resultUndefined = validateInvitationState(undefined);
    expect(resultUndefined.valid).toBe(false);
    expect(resultUndefined.status).toBe('MISSING_TOKEN');
  });

  it('shows error for expired token @REQ: FAM-ONBOARDING', () => {
    const expiredInvite: InvitationRecord = {
      ...baseInvitation,
      expires_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    };
    const result = validateInvitationState(expiredInvite);
    expect(result.valid).toBe(false);
    expect(result.status).toBe('EXPIRED');
    expect(result.message).toMatch(/wygasło/i);
  });

  it('shows error for revoked token @REQ: FAM-ONBOARDING', () => {
    const revokedInvite: InvitationRecord = {
      ...baseInvitation,
      revoked_at: new Date().toISOString(),
    };
    const result = validateInvitationState(revokedInvite);
    expect(result.valid).toBe(false);
    expect(result.status).toBe('REVOKED');
    expect(result.message).toMatch(/odwołane/i);
  });

  it('shows error for already claimed token @REQ: FAM-ONBOARDING', () => {
    const claimedInvite: InvitationRecord = {
      ...baseInvitation,
      claimed_at: new Date().toISOString(),
    };
    const result = validateInvitationState(claimedInvite);
    expect(result.valid).toBe(false);
    expect(result.status).toBe('CLAIMED');
    expect(result.message).toMatch(/zostało już wykorzystane/i);
  });

  it('validates active token and masks recipient email without leaking PII @REQ: FAM-ONBOARDING', () => {
    const result = validateInvitationState(baseInvitation);
    expect(result.valid).toBe(true);
    expect(result.status).toBe('ACTIVE');
    expect(result.role).toBe('family');
    expect(result.maskedEmail).toBe('j***a@example.com');
    // Ensure no resident PII exists in validation output
    expect((result as any).resident_id).toBeUndefined();
    expect((result as any).first_name).toBeUndefined();
    expect((result as any).pesel).toBeUndefined();
  });

  it('masks various email formats correctly @REQ: FAM-ONBOARDING', () => {
    expect(maskEmail('a@test.com')).toBe('a***@test.com');
    expect(maskEmail('adam@domain.pl')).toBe('a***m@domain.pl');
    expect(maskEmail('krystyna.nowak@care.org')).toBe('k***k@care.org');
  });

  it('enforces consents requirement for account activation @REQ: FAM-ONBOARDING', () => {
    // If consentsAccepted is false, activation is not allowed
    const guardianInvite: InvitationRecord = {
      ...baseInvitation,
      role: 'legal_guardian',
    };

    const withoutConsents = determineConsentsForRole(guardianInvite.role, false);
    expect(withoutConsents.allowed).toBe(false);
    expect(withoutConsents.error).toMatch(/zgód/i);

    const withConsentsGuardian = determineConsentsForRole(guardianInvite.role, true);
    expect(withConsentsGuardian.allowed).toBe(true);
    expect(withConsentsGuardian.canGrantArt9).toBe(true);
    expect(withConsentsGuardian.purposes).toContain('wellness_data_ingest');
    expect(withConsentsGuardian.purposes).toContain('family_view_basic');

    const withConsentsFamily = determineConsentsForRole('family', true);
    expect(withConsentsFamily.allowed).toBe(true);
    expect(withConsentsFamily.canGrantArt9).toBe(false);
    expect(withConsentsFamily.purposes).toHaveLength(0);
  });

  it('respects MDR vocabulary: no patient terms in error and info messages @REQ: FAM-ONBOARDING', () => {
    const states: (InvitationRecord | null)[] = [
      null,
      { ...baseInvitation, expires_at: new Date(0).toISOString() },
      { ...baseInvitation, revoked_at: new Date().toISOString() },
      { ...baseInvitation, claimed_at: new Date().toISOString() },
      baseInvitation,
    ];

    for (const state of states) {
      const res = validateInvitationState(state);
      expect(res.message.toLowerCase()).not.toMatch(/pacjent/);
    }
  });
});
