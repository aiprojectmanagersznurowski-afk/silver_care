import { describe, it, expect } from 'vitest';
import {
  evaluateOAuthInviteClaim,
  OAuthInviteClaimInput,
} from '../../apps/web/src/lib/invite-authorization';
import { resolveAcceptInviteAction } from '../../apps/web/src/lib/invite-url-helper';
import { resolveRelativeRole } from '../../apps/web/src/lib/onboarding';

/**
 * @REQ: CONSENT-GRANTOR
 * @REQ: ADM-INVITE
 * @REQ: FAM-ONBOARDING
 *
 * Karta #163: OAUTH-GUARDIAN-CONSENTS
 * Weryfikacja wymogu zgód i regulaminu przy realizacji zaproszenia przez Google OAuth
 */

const ORG_A = '11111111-1111-4111-8111-111111111111';

describe('Wymuszenie zgód Art. 9 RODO przy Google OAuth (@REQ: CONSENT-GRANTOR, @REQ: FAM-ONBOARDING, @REQ: ADM-INVITE)', () => {
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

  it('proces onboarding zaproszenia bliskiego przekierowuje do rejestracji z tokenem @REQ: FAM-ONBOARDING', () => {
    const action = resolveAcceptInviteAction({ token: 'guardian-token-xyz' }, 'https://silvercare.space');
    expect(action.state).toBe('REDIRECT');
    expect(action.destinationUrl).toBe('/register?token=guardian-token-xyz');
    expect(resolveRelativeRole('legal_guardian')).toBe('legal_guardian');
  });

  it('odrzuca realizację zaproszenia dla kont z rolami personelu (fail-closed) @REQ: ADM-INVITE', () => {
    const input: OAuthInviteClaimInput = {
      currentUserRole: 'org_admin',
      currentUserOrgId: ORG_A,
      invitationRole: 'legal_guardian',
      invitationOrgId: ORG_A,
      consentsAccepted: true,
    };

    const result = evaluateOAuthInviteClaim(input);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.errorCode).toBe('STAFF_ROLE_CONFLICT');
    }
  });
});
