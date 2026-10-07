import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  evaluateOAuthInviteClaim,
  OAuthInviteClaimInput,
} from '../../apps/web/src/lib/invite-authorization';

/**
 * @REQ: CONSENT-GRANTOR
 * @REQ: ADM-INVITE
 * @REQ: FAM-ONBOARDING
 *
 * Karta #163: OAUTH-GUARDIAN-CONSENTS
 * Weryfikacja wymogu zgód i regulaminu przy realizacji zaproszenia przez Google OAuth
 */

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const ORG_A = '11111111-1111-4111-8111-111111111111';

describe('Wymuszenie zgód Art. 9 RODO przy Google OAuth (@REQ: CONSENT-GRANTOR, @REQ: FAM-ONBOARDING)', () => {
  it('odrzuca nadanie roli legal_guardian nowemu użytkownikowi bez zaakceptowanych zgód @REQ: CONSENT-GRANTOR', () => {
    const input: OAuthInviteClaimInput = {
      currentUserRole: null,
      currentUserOrgId: null,
      invitationRole: 'legal_guardian',
      invitationOrgId: ORG_A,
      consentsAccepted: false,
    };

    const result = evaluateOAuthInviteClaim(input);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.errorCode).toBe('CONSENTS_REQUIRED');
      expect(result.error).toContain('zgód');
    }
  });

  it('odrzuca awans z family do legal_guardian bez zaakceptowanych zgód @REQ: CONSENT-GRANTOR', () => {
    const input: OAuthInviteClaimInput = {
      currentUserRole: 'family',
      currentUserOrgId: ORG_A,
      invitationRole: 'legal_guardian',
      invitationOrgId: ORG_A,
      consentsAccepted: false,
    };

    const result = evaluateOAuthInviteClaim(input);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.errorCode).toBe('CONSENTS_REQUIRED');
      expect(result.error).toContain('zgód');
    }
  });

  it('pozwala na realizację roli legal_guardian z zaakceptowanymi zgodami i oznacza wymóg wpisu do consent_ledger @REQ: CONSENT-GRANTOR', () => {
    const input: OAuthInviteClaimInput = {
      currentUserRole: null,
      currentUserOrgId: null,
      invitationRole: 'legal_guardian',
      invitationOrgId: ORG_A,
      consentsAccepted: true,
    };

    const result = evaluateOAuthInviteClaim(input);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.assignedRole).toBe('legal_guardian');
      expect(result.requiresConsentLedgerInsert).toBe(true);
    }
  });

  it('nie wymaga ponownego wpisu do consent_ledger dla użytkownika będącego już legal_guardian @REQ: CONSENT-GRANTOR', () => {
    const input: OAuthInviteClaimInput = {
      currentUserRole: 'legal_guardian',
      currentUserOrgId: ORG_A,
      invitationRole: 'family',
      invitationOrgId: ORG_A,
      consentsAccepted: true,
    };

    const result = evaluateOAuthInviteClaim(input);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.requiresConsentLedgerInsert).toBe(false);
    }
  });

  it('strona rejestracji blokuje przycisk Google i ustawia invite_consents_accepted @REQ: FAM-ONBOARDING', () => {
    const src = read('apps/web/src/app/register/page.tsx');
    expect(src).toContain('invite_consents_accepted');
    expect(src).toMatch(/disabled=\{\s*isSubmitting\s*\|\|\s*!consentsValid\s*\}/);
  });

  it('route callback OAuth obsługuje brak zgód i rejestruje wpis do consent_ledger @REQ: ADM-INVITE, @REQ: CONSENT-GRANTOR', () => {
    const src = read('apps/web/src/app/auth/callback/route.ts');
    expect(src).toContain('invite_consents_accepted');
    expect(src).toContain('consent_ledger');
    expect(src).toContain('FAMILY_ACCOUNT_ACTIVATED');
  });
});
