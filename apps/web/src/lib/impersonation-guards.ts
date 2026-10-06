/**
 * Security guards for Super Admin Impersonation Mode
 * REQ: SUP-IMPERSONATION, SEC-NO-PII-LOGS
 */

/** Maksymalny czas trwania podglądu placówki (zgodnie z TTL ciasteczka: 1 godzina). */
export const IMPERSONATION_TTL_MS = 60 * 60 * 1000;

export interface ImpersonationCookieSession {
  targetAdminId: string;
  targetOrgId: string;
  targetOrgName: string;
  adminEmail: string;
  impersonatorId: string;
  startedAt: string;
}

type CookieJar = { get(name: string): { value: string } | undefined };
type SessionUser = { id: string; app_metadata?: Record<string, unknown> | null } | null | undefined;

/**
 * Zwraca sesję podglądu tylko wtedy, gdy ciasteczko należy do zalogowanego super_admina,
 * który ją rozpoczął, i nie wygasło. Samo istnienie ciasteczka nic nie znaczy: przeżywa wylogowanie,
 * więc zwykły administrator w tej samej przeglądarce widziałby maskowane, puste listy (SUP-IMPERSONATION).
 */
export function getActiveImpersonation(cookieStore: CookieJar, user: SessionUser): ImpersonationCookieSession | null {
  const raw = cookieStore.get('sc_impersonation')?.value;
  if (!raw || !user || user.app_metadata?.role !== 'super_admin') return null;
  let session: Partial<ImpersonationCookieSession>;
  try {
    session = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!session || session.impersonatorId !== user.id || typeof session.startedAt !== 'string') return null;
  const startedAt = Date.parse(session.startedAt);
  if (!Number.isFinite(startedAt) || Date.now() - startedAt > IMPERSONATION_TTL_MS) return null;
  return session as ImpersonationCookieSession;
}

export function isImpersonationSessionActive(cookieStore: CookieJar, user: SessionUser): boolean {
  return getActiveImpersonation(cookieStore, user) !== null;
}

export function assertMutationAllowedDuringImpersonation(isImpersonating: boolean): {
  allowed: boolean;
  status?: number;
  error?: string;
} {
  if (isImpersonating) {
    return {
      allowed: false,
      status: 403,
      error: 'Operacja niedozwolona w trybie podglądu (impersonacji). Tryb jest ściśle Read-Only.',
    };
  }
  return { allowed: true };
}

export function maskResidentListForImpersonation<T>(
  residents: T[] | null | undefined,
  isImpersonating: boolean
): { count: number; residents: T[]; masked: boolean } {
  const list = residents || [];
  if (isImpersonating) {
    return {
      count: list.length,
      residents: [],
      masked: true,
    };
  }
  return {
    count: list.length,
    residents: list,
    masked: false,
  };
}
