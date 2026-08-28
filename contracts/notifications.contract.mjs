/**
 * notifications.contract.mjs — katalog powiadomień.
 *
 * Zasada nadrzędna (ADR-005): jedynym wyzwalaczem powiadomienia jest publikacja
 * raportu. Żadna metryka z urządzenia nie generuje wiadomości — system jest cichy
 * wobec danych z opaski. Powiadomienie o spadku aktywności byłoby funkcją
 * monitorowania stanu i wprowadzałoby produkt w zakres wyrobu medycznego.
 *
 * Zasada druga (ADR-008): treść powiadomienia nie zawiera danych osobowych ani
 * zdrowotnych. SMS trafia na telefon, który może leżeć na stole — wiadomość
 * zaprasza do portalu i nic więcej.
 */

export const CHANNELS = ['EMAIL', 'SMS', 'IN_APP'];
export const RECIPIENTS = ['LEGAL_GUARDIAN', 'FAMILY', 'NURSE', 'ORG_ADMIN', 'SUPER_ADMIN'];

export const NOTIFICATIONS = [
  { id: 'F1', domain: 'FAMILY', trigger: 'daily_report_published', channels: ['SMS', 'EMAIL'], recipient: 'FAMILY', vars: ['portal_link'], containsPersonalData: false, templateKey: 'family.report_ready', req: ['NTF-REPORT-READY', 'NTF-NO-PII'], status: 'STABLE', note: 'Jedyne powiadomienie wyzwalane treścią opieki. Bez imienia i bez metryk.' },
  { id: 'F2', domain: 'FAMILY', trigger: 'invitation_sent', channels: ['EMAIL'], recipient: 'FAMILY', vars: ['activation_link', 'expires_in_days'], containsPersonalData: false, templateKey: 'family.invitation', req: ['ADM-INVITE'], status: 'STABLE', note: 'Anonimowe powitanie — bez danych pensjonariusza przed aktywacją konta.' },
  { id: 'F3', domain: 'FAMILY', trigger: 'access_revoked', channels: ['EMAIL'], recipient: 'FAMILY', vars: ['organization_name'], containsPersonalData: false, templateKey: 'family.access_revoked', req: ['CONSENT-REVOKE'], status: 'STABLE', note: 'Informacja o cofnięciu dostępu. Bez wskazania, kogo dotyczyło.' },
  { id: 'S1', domain: 'STAFF', trigger: 'missing_note_evening', channels: ['IN_APP'], recipient: 'NURSE', vars: ['residents_without_note_count'], containsPersonalData: false, templateKey: 'staff.missing_notes', req: ['NUR-BOARD'], status: 'STABLE', note: 'Licznik, nie lista nazwisk — powiadomienie nie przenosi danych osobowych.' },
  { id: 'S2', domain: 'STAFF', trigger: 'voice_sync_completed', channels: ['IN_APP'], recipient: 'NURSE', vars: ['synced_count'], containsPersonalData: false, templateKey: 'staff.voice_synced', req: ['VOICE-OFFLINE'], status: 'STABLE', note: 'Potwierdzenie wysłania nagrań zakolejkowanych offline.' },
  { id: 'S3', domain: 'STAFF', trigger: 'family_message_received', channels: ['IN_APP'], recipient: 'NURSE', vars: ['resident_initials'], containsPersonalData: false, templateKey: 'staff.family_message', req: ['FAM-MESSAGES'], status: 'STABLE', note: 'Inicjały zamiast pełnego nazwiska.' },
  { id: 'A1', domain: 'ADMIN', trigger: 'device_sync_stale', channels: ['IN_APP', 'EMAIL'], recipient: 'ORG_ADMIN', vars: ['device_count', 'threshold_hours'], containsPersonalData: false, templateKey: 'admin.sync_stale', req: ['INT-SYNC-STALENESS'], status: 'STABLE', note: 'Problem techniczny synchronizacji, adresowany do administratora — nie do rodziny i nie jako sygnał o stanie pensjonariusza.' },
  { id: 'A2', domain: 'ADMIN', trigger: 'consent_expiring', channels: ['EMAIL'], recipient: 'ORG_ADMIN', vars: ['consent_count'], containsPersonalData: false, templateKey: 'admin.consent_expiring', req: ['CONSENT-GRANTOR'], status: 'STABLE', note: 'Przypomnienie o zgodach wymagających odnowienia.' },
  { id: 'A3', domain: 'ADMIN', trigger: 'ingest_rejected_repeatedly', channels: ['EMAIL'], recipient: 'ORG_ADMIN', vars: ['rejection_count', 'reason_code'], containsPersonalData: false, templateKey: 'admin.ingest_rejected', req: ['INT-INGEST-PRECONDITIONS'], status: 'STABLE', note: 'Kod przyczyny, nie treść odrzuconych danych.' },
  { id: 'X1', domain: 'SECURITY', trigger: 'access_denied_threshold', channels: ['EMAIL'], recipient: 'SUPER_ADMIN', vars: ['attempt_count', 'source_ip'], containsPersonalData: false, templateKey: 'security.access_denied', req: ['SEC-403-LOGGING'], status: 'STABLE', note: 'Alert bezpieczeństwa — kontekst techniczny bez danych pensjonariuszy.' },
];

/** Zakazane wyzwalacze. Trzymane jawnie, żeby próba dodania kończyła się rozmową, nie commitem. */
export const FORBIDDEN_TRIGGERS = [
  { trigger: 'steps_below_threshold', reason: 'ADR-005: alarm oparty na metryce czyni system narzędziem monitorowania stanu.' },
  { trigger: 'heart_rate_anomaly',    reason: 'ADR-005: parametr fizjologiczny nie może wyzwalać powiadomienia.' },
  { trigger: 'sleep_quality_drop',    reason: 'ADR-005: ocena jakości snu to interpretacja kliniczna.' },
  { trigger: 'no_activity_detected',  reason: 'ADR-005: wymaga osobnej decyzji prawnej — obecnie poza zakresem.' },
];

export const QUEUE_POLICY = {
  sendWindow: { EMAIL: '00:00-23:59', SMS: '08:00-20:00', IN_APP: '00:00-23:59' },
  timezone: 'Europe/Warsaw',
  maxAttempts: 5,
  backoff: 'exponential',
  deadLetterAfterAttempts: 5,
  idempotencyKey: '(notification_id, recipient_profile_id, trigger_date)',
};
