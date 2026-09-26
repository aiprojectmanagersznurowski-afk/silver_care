/**
 * Security guards for Super Admin Impersonation Mode
 * REQ: SUP-IMPERSONATION, SEC-NO-PII-LOGS
 */

export function isImpersonationSessionActive(cookieStore: {
  get(name: string): { value: string } | undefined;
}): boolean {
  const cookie = cookieStore.get('sc_impersonation');
  return !!cookie?.value;
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
