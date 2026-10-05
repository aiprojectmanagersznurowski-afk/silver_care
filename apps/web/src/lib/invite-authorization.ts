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
