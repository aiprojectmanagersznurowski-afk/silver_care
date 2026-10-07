/**
 * @REQ: ORG-ISOLATION
 * @REQ: ADM-INVITE
 *
 * Autoryzacja celu zaproszenia bliskiego: pensjonariusz musi należeć do placówki
 * z tokenu wywołującego. Nieistniejący i obcy pensjonariusz dają tę samą odpowiedź,
 * żeby endpoint nie był wyrocznią istnienia rekordów innych placówek.
 */

export interface InviteTargetInput {
  appRole: string | null | undefined;
  tokenOrgId: string | null | undefined;
  residentOrgId: string | null | undefined;
}

export type InviteTargetDecision =
  | { ok: true; organizationId: string }
  | { ok: false; status: 404 };

export function authorizeInviteTarget({ appRole, tokenOrgId, residentOrgId }: InviteTargetInput): InviteTargetDecision {
  if (!residentOrgId) return { ok: false, status: 404 };

  // super_admin bez przypisanej placówki działa globalnie i dziedziczy placówkę pensjonariusza
  if (appRole === 'super_admin' && !tokenOrgId) {
    return { ok: true, organizationId: residentOrgId };
  }

  if (!tokenOrgId || tokenOrgId !== residentOrgId) return { ok: false, status: 404 };

  return { ok: true, organizationId: tokenOrgId };
}

/**
 * @REQ: CONSENT-GRANTOR
 * @REQ: ORG-ISOLATION
 * @REQ: ADM-INVITE
 *
 * Bezpieczna realizacja zaproszenia przez OAuth (/auth/callback):
 * 1. Konta personelu i administratorów nie mogą realizować zaproszenia (STAFF_ROLE_CONFLICT) - fail-closed.
 * 2. Istniejące konto rodziny nie może realizować zaproszenia do obcej placówki (ORGANIZATION_MISMATCH).
 * 3. Nowe konto otrzymuje rolę z zaproszenia.
 * 4. Istniejący opiekun prawny (legal_guardian) nie jest degradowany do family (CONSENT-GRANTOR).
 * 5. Istniejący członek rodziny (family) może awansować do legal_guardian przy nowym zaproszeniu.
 */

const STAFF_ROLES = new Set([
  'super_admin',
  'org_admin',
  'nurse',
  'admin',
  'facility_manager',
  'paramedic',
  'caregiver',
]);

export interface OAuthInviteClaimInput {
  currentUserRole: string | null | undefined;
  currentUserOrgId: string | null | undefined;
  invitationRole: string;
  invitationOrgId: string;
}

export type OAuthInviteClaimResult =
  | {
      allowed: true;
      isNewRoleAssignment: boolean;
      assignedRole: 'legal_guardian' | 'family';
      organizationId: string;
    }
  | {
      allowed: false;
      errorCode: 'STAFF_ROLE_CONFLICT' | 'ORGANIZATION_MISMATCH';
      error: string;
    };

export function evaluateOAuthInviteClaim(input: OAuthInviteClaimInput): OAuthInviteClaimResult {
  const { currentUserRole, currentUserOrgId, invitationRole, invitationOrgId } = input;

  // 1. Sprawdzenie ról personelu i administratorów (fail-closed)
  if (currentUserRole && (STAFF_ROLES.has(currentUserRole) || (currentUserRole !== 'family' && currentUserRole !== 'legal_guardian'))) {
    return {
      allowed: false,
      errorCode: 'STAFF_ROLE_CONFLICT',
      error: 'Konto posiada przypisaną rolę personelu lub administratora — nie może realizować zaproszenia dla bliskich.',
    };
  }

  // 2. Sprawdzenie izolacji placówek (ORG-ISOLATION)
  if (currentUserOrgId && currentUserOrgId !== invitationOrgId) {
    return {
      allowed: false,
      errorCode: 'ORGANIZATION_MISMATCH',
      error: 'Konto jest powiązane z innej placówki niż zaproszenie.',
    };
  }

  const targetRole = invitationRole === 'legal_guardian' ? 'legal_guardian' : 'family';

  // 3. Nowy użytkownik bez roli
  if (!currentUserRole) {
    return {
      allowed: true,
      isNewRoleAssignment: true,
      assignedRole: targetRole,
      organizationId: invitationOrgId,
    };
  }

  // 4. Istniejący opiekun prawny — nie degradujemy do family (CONSENT-GRANTOR)
  if (currentUserRole === 'legal_guardian') {
    return {
      allowed: true,
      isNewRoleAssignment: false,
      assignedRole: 'legal_guardian',
      organizationId: currentUserOrgId || invitationOrgId,
    };
  }

  // 5. Istniejący członek rodziny (family)
  if (currentUserRole === 'family') {
    if (targetRole === 'legal_guardian') {
      return {
        allowed: true,
        isNewRoleAssignment: true,
        assignedRole: 'legal_guardian',
        organizationId: invitationOrgId,
      };
    }

    return {
      allowed: true,
      isNewRoleAssignment: false,
      assignedRole: 'family',
      organizationId: currentUserOrgId || invitationOrgId,
    };
  }

  // Fallback bezpieczeństwa
  return {
    allowed: false,
    errorCode: 'STAFF_ROLE_CONFLICT',
    error: 'Nieprawidłowa rola konta personelu lub użytkownika.',
  };
}

