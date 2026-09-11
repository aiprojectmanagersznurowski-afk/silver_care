/**
 * Logika weryfikacji i reguł biznesowych onboardingu rodziny (FAM-ONBOARDING).
 * Zgodna z ADR-003, ADR-005, CONSENT-GRANTOR oraz regułami słownictwa MDR.
 */

export interface InvitationRecord {
  id: string;
  organization_id: string;
  resident_id: string;
  role: 'family' | 'legal_guardian' | string;
  email: string;
  expires_at: string;
  revoked_at?: string | null;
  claimed_at?: string | null;
}

export type InvitationStatus = 
  | 'ACTIVE' 
  | 'MISSING_TOKEN' 
  | 'NOT_FOUND' 
  | 'EXPIRED' 
  | 'REVOKED' 
  | 'CLAIMED';

export interface InvitationValidationResult {
  valid: boolean;
  status: InvitationStatus;
  message: string;
  role?: 'family' | 'legal_guardian' | string;
  maskedEmail?: string;
}

/**
 * Bezpieczne maskowanie adresu e-mail, aby nie ujawniać pełnych danych (SEC-NO-PII).
 * Np. janina.kowalska@example.com -> j***a@example.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Walidacja stanu zaproszenia w oparciu o cykl życia (ADM-INVITE, FAM-ONBOARDING).
 * Komunikaty posługują się terminologią opiekuńczą (podopieczny / pensjonariusz).
 */
export function validateInvitationState(
  invitation: InvitationRecord | null | undefined
): InvitationValidationResult {
  if (!invitation || !invitation.id) {
    return {
      valid: false,
      status: 'MISSING_TOKEN',
      message: 'Brak tokena rejestracji lub zaproszenie nie istnieje. Użyj linku przesłanego w wiadomości e-mail.',
    };
  }

  if (invitation.claimed_at) {
    return {
      valid: false,
      status: 'CLAIMED',
      message: 'To zaproszenie zostało już wykorzystane. Możesz zalogować się na swoje konto.',
    };
  }

  if (invitation.revoked_at) {
    return {
      valid: false,
      status: 'REVOKED',
      message: 'To zaproszenie zostało odwołane przez placówkę. Skontaktuj się z personelem, aby otrzymać nowe zaproszenie.',
    };
  }

  const expiresAt = new Date(invitation.expires_at).getTime();
  if (isNaN(expiresAt) || expiresAt < Date.now()) {
    return {
      valid: false,
      status: 'EXPIRED',
      message: 'To zaproszenie wygasło. Linki są ważne przez 7 dni. Poproś placówkę o ponowne wysłanie zaproszenia.',
    };
  }

  return {
    valid: true,
    status: 'ACTIVE',
    message: 'Zaproszenie jest aktywne.',
    role: invitation.role,
    maskedEmail: maskEmail(invitation.email),
  };
}

export interface ConsentsEvaluation {
  allowed: boolean;
  canGrantArt9: boolean;
  purposes: ('wellness_data_ingest' | 'family_view_basic')[];
  error?: string;
}

/**
 * Ustalanie uprawnień do wyrażania zgód Art. 9 RODO (CONSENT-GRANTOR).
 * Wyłącznie legal_guardian oraz resident_self mogą wyrażać zgody na przetwarzanie danych zdrowotnych.
 */
export function determineConsentsForRole(
  role: string,
  consentsAccepted: boolean
): ConsentsEvaluation {
  if (!consentsAccepted) {
    return {
      allowed: false,
      canGrantArt9: false,
      purposes: [],
      error: 'Akceptacja regulaminu i zgód jest wymagana do aktywacji konta.',
    };
  }

  if (role === 'legal_guardian') {
    return {
      allowed: true,
      canGrantArt9: true,
      purposes: ['wellness_data_ingest', 'family_view_basic'],
    };
  }

  return {
    allowed: true,
    canGrantArt9: false,
    purposes: [],
  };
}
