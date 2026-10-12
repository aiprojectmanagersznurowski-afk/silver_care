import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  evaluateOAuthInviteClaim,
  OAuthInviteClaimInput,
} from '../../apps/web/src/lib/invite-authorization';

/**
 * @REQ: CONSENT-GRANTOR
 * @REQ: ORG-ISOLATION
 * @REQ: ADM-INVITE
 *
 * Karta #167: SEC-OAUTH-METADATA-OVERWRITE
 * Zapobieganie nadpisaniu app_metadata (rola, placówka) istniejącego konta
 * podczas realizacji zaproszenia przez Google OAuth (/auth/callback).
 */

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';

describe('Bezpieczna realizacja zaproszenia OAuth (@REQ: CONSENT-GRANTOR, @REQ: ORG-ISOLATION)', () => {
  it('odrzuca realizację zaproszenia dla kont z rolą personelu lub administratora (fail-closed) @REQ: ORG-ISOLATION', () => {
    const staffRoles = ['super_admin', 'org_admin', 'nurse', 'admin', 'facility_manager', 'paramedic', 'caregiver'];

    for (const role of staffRoles) {
      const input: OAuthInviteClaimInput = {
        currentUserRole: role,
        currentUserOrgId: ORG_A,
        invitationRole: 'family',
        invitationOrgId: ORG_A,
      };

      const result = evaluateOAuthInviteClaim(input);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.errorCode).toBe('STAFF_ROLE_CONFLICT');
        expect(result.error).toContain('personelu');
      }
    }
  });

  it('odrzuca realizację zaproszenia dla istniejącej rodziny z innej placówki @REQ: ORG-ISOLATION', () => {
    const input: OAuthInviteClaimInput = {
      currentUserRole: 'family',
      currentUserOrgId: ORG_A,
      invitationRole: 'family',
      invitationOrgId: ORG_B,
    };

    const result = evaluateOAuthInviteClaim(input);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.errorCode).toBe('ORGANIZATION_MISMATCH');
      expect(result.error).toContain('innej');
    }
  });

  it('pozwala nowemu użytkownikowi bez roli zrealizować zaproszenie z przypisaniem roli @REQ: CONSENT-GRANTOR', () => {
    const input: OAuthInviteClaimInput = {
      currentUserRole: null,
      currentUserOrgId: null,
      invitationRole: 'legal_guardian',
      invitationOrgId: ORG_A,
    };

    const result = evaluateOAuthInviteClaim(input);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.isNewRoleAssignment).toBe(true);
      expect(result.assignedRole).toBe('legal_guardian');
      expect(result.organizationId).toBe(ORG_A);
    }
  });

  it('nie degraduje roli legal_guardian do family przy kolejnym zaproszeniu w tej samej placówce @REQ: CONSENT-GRANTOR', () => {
    const input: OAuthInviteClaimInput = {
      currentUserRole: 'legal_guardian',
      currentUserOrgId: ORG_A,
      invitationRole: 'family',
      invitationOrgId: ORG_A,
    };

    const result = evaluateOAuthInviteClaim(input);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.isNewRoleAssignment).toBe(false);
      expect(result.assignedRole).toBe('legal_guardian');
      expect(result.organizationId).toBe(ORG_A);
    }
  });

  it('awansuje rolę family do legal_guardian jeśli nowe zaproszenie w tej samej placówce to legal_guardian @REQ: CONSENT-GRANTOR', () => {
    const input: OAuthInviteClaimInput = {
      currentUserRole: 'family',
      currentUserOrgId: ORG_A,
      invitationRole: 'legal_guardian',
      invitationOrgId: ORG_A,
    };

    const result = evaluateOAuthInviteClaim(input);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.isNewRoleAssignment).toBe(true);
      expect(result.assignedRole).toBe('legal_guardian');
      expect(result.organizationId).toBe(ORG_A);
    }
  });

  it('route callback OAuth używa evaluateOAuthInviteClaim i nie nadpisuje app_metadata kont personelu @REQ: ADM-INVITE', () => {
    const src = read('apps/web/src/app/auth/callback/route.ts');
    expect(src).toContain('evaluateOAuthInviteClaim');
    expect(src).not.toMatch(/updateUserById\s*\(\s*user\.id\s*,\s*\{\s*user_metadata[\s\S]*app_metadata:\s*\{\s*role:\s*relativeRole/);
  });
});
