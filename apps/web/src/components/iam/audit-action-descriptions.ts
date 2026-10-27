/**
 * Opisy zdarzeń w rejestrze zmian uprawnień. Zdarzenie audytu to fakt, nie błąd —
 * czerwień jest zarezerwowana dla błędów technicznych (decyzja Michała 2026-10-26).
 */
export type AuditTone = 'muted' | 'strong' | 'brand'

export const AUDIT_TONE_CLASS: Record<AuditTone, string> = {
  muted: 'text-muted-foreground',
  strong: 'text-foreground font-medium',
  brand: 'text-primary font-medium',
}

export const AUDIT_ACTION_DESCRIPTIONS: Record<string, { text: string; tone: AuditTone }> = {
  password_reset: { text: 'Reset i aktualizacja hasła konta', tone: 'muted' },
  USER_DEACTIVATED: { text: 'Blokada konta (deaktywacja)', tone: 'strong' },
  USER_ACTIVATED: { text: 'Odblokowanie konta (reaktywacja)', tone: 'brand' },
  USER_HARD_DELETED: { text: 'Trwałe usunięcie konta z bazy', tone: 'strong' },
}
