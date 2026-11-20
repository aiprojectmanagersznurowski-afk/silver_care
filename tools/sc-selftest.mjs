#!/usr/bin/env node
/**
 * sc-selftest — dowód żywotności reguł bramki.
 *
 * Każda mutacja psuje kontrakt w jeden konkretny sposób i sprawdza, czy
 * walidator to wyłapie. Reguła, która nie zapala się na swojej mutacji,
 * jest martwa — wygląda jak ochrona, a nią nie jest.
 *
 * Mutacje są nakładane na KOPIĘ kontraktów w katalogu tymczasowym.
 * Oryginał nie jest dotykany.
 */
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SC_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');

const MUTATIONS = [
  { rule: 'R02-consent-grantor', file: 'roles.contract.mjs', from: "export const CONSENT_GRANTORS = ['resident_self', 'legal_guardian'];", to: "export const CONSENT_GRANTORS = ['resident_self', 'legal_guardian', 'family'];", desc: 'rodzina wyraża zgodę na dane o zdrowiu' },
  { rule: 'R03-consent-immutable', file: 'roles.contract.mjs', from: "{ resource: 'consent_ledger',          read: ['org_admin:own', 'legal_guardian:own'],     create: ['org_admin'],    update: [],", to: "{ resource: 'consent_ledger',          read: ['org_admin:own', 'legal_guardian:own'],     create: ['org_admin'],    update: ['org_admin'],", desc: 'rejestr zgód staje się edytowalny' },
  { rule: 'R04-mdr-family-metrics', file: 'presentation.contract.mjs', from: "{ id: 'sleep_start_time',   unit: 'godzina', source: 'wellness_daily.sleep_start_time',   kind: 'BEHAVIORAL', desc: 'Godzina zaśnięcia.' },", to: "{ id: 'hrv_ms',   unit: 'ms', source: 'wellness_daily.hrv_ms',   kind: 'PHYSIOLOGICAL', desc: 'HRV.' },", desc: 'HRV wystawione bliskim' },
  { rule: 'R05-mapping-visibility', file: 'integration.contract.mjs', from: "{ canonical: 'hrv_ms',                 provider: 'POLAR', from: 'nightly_recharge.heart_rate_variability_ms', kind: 'PHYSIOLOGICAL', familyVisible: false },", to: "{ canonical: 'hrv_ms',                 provider: 'POLAR', from: 'nightly_recharge.heart_rate_variability_ms', kind: 'PHYSIOLOGICAL', familyVisible: true },", desc: 'mapowanie fizjologiczne oznaczone jako widoczne' },
  { rule: 'R06-core-decoupled', file: 'integration.contract.mjs', from: "  externalKeys: ['provider', 'external_user_id', 'external_device_id'],", to: "  externalKeys: ['provider', 'polar_user_id', 'external_device_id'],", desc: 'identyfikator dostawcy wraca do rdzenia' },
  { rule: 'R07-redact-before-llm', file: 'voice.contract.mjs', from: "    reachesLLM: false,\n    audience: ['nurse', 'org_admin'],\n    desc: 'Leki, diagnozy", to: "    reachesLLM: true,\n    audience: ['nurse', 'org_admin'],\n    desc: 'Leki, diagnozy", desc: 'dane medyczne trafiają do modelu' },
  { rule: 'R08-zero-guessing', file: 'voice.contract.mjs', from: "input: 'audio + resident_id (UUID) z aplikacji albo audio z urządzenia bez resident_id'", to: "input: 'audio'", desc: 'nagranie bez twardego identyfikatora' },
  { rule: 'R08-zero-guessing', file: 'voice.contract.mjs', from: "{ id: 'APP',    residentId: 'AT_CAPTURE',", to: "{ id: 'APP',    residentId: 'FROM_TRANSCRIPT',", desc: 'podopieczny ustalany z treści nagrania' },
  { rule: 'R08-zero-guessing', file: 'voice.contract.mjs', from: "{ id: 'ASSIGN',    actor: 'nurse',", to: "{ id: 'ASSIGN',    actor: 'llm',", desc: 'model przypisuje podopiecznego do nagrania z urządzenia' },
  { rule: 'R08-zero-guessing', file: 'voice.contract.mjs', from: "  llmIdentifies: false,", to: "  llmIdentifies: true,", desc: 'model podsuwa tożsamość z nagrania' },
  { rule: 'R08-zero-guessing', file: 'voice.contract.mjs', from: "  onUnconfirmed: 'HOLD_BEFORE_CLASSIFY',", to: "  onUnconfirmed: 'CONTINUE',", desc: 'nagranie bez potwierdzenia idzie do klasyfikacji' },
  { rule: 'R08-zero-guessing', file: 'voice.contract.mjs', from: "  { id: 'ASSIGN',    actor: 'nurse',", to: "  { id: 'ASSIGN_REMOVED', actor: 'nurse',", desc: 'nagrania z urządzenia bez etapu przypisania' },
  { rule: 'R31-shift-lead', file: 'roles.contract.mjs', from: "  readResources: ['voice_assignment_queue'],", to: "  readResources: ['voice_assignment_queue', 'daily_logs'],", desc: 'kierownik zmiany z dodatkowym odczytem brudnopisu' },
  { rule: 'R33-voice-devices', file: 'roles.contract.mjs', from: "{ resource: 'voice_devices',           read: ['org_admin:own', 'nurse:own'],", to: "{ resource: 'voice_devices',           read: ['org_admin:own', 'nurse:own', 'family:own'],", desc: 'rodzina widzi rejestr urządzeń' },
  { rule: 'R33-voice-devices', file: 'roles.contract.mjs', from: "create: ['org_admin:own', 'nurse:shift_lead'], update: ['org_admin:own', 'nurse:shift_lead'], delete: [] },\n  { resource: 'voice_assignment_queue',", to: "create: ['org_admin:own', 'nurse:shift_lead'], update: ['org_admin:own', 'nurse:shift_lead'], delete: ['org_admin:own'] },\n  { resource: 'voice_assignment_queue',", desc: 'przydział urządzenia usuwany zamiast zamknięty' },
  { rule: 'R33-voice-devices', file: 'roles.contract.mjs', from: "{ resource: 'voice_assignment_queue',  read: ['org_admin:own', 'nurse:shift_lead'],", to: "{ resource: 'voice_assignment_queue',  read: ['org_admin:own', 'nurse:shift_lead', 'nurse:own'],", desc: 'każdy personel czyta cudze nagrania w kolejce' },
  { rule: 'R33-voice-devices', file: 'roles.contract.mjs', from: "{ resource: 'voice_draft_notes',       read: ['nurse:own'],", to: "{ resource: 'voice_draft_notes',       read: ['nurse:own', 'org_admin:own'],", desc: 'kierownik placówki czyta wszystkie brudnopisy głosowe' },
  { rule: 'R17-retention', file: 'voice.contract.mjs', from: "  ttlDays: 30,", to: "  ttlDays: 120,", desc: 'domyślna retencja nagrań poza dozwolonym zakresem' },
  { rule: 'R17-retention', file: 'voice.contract.mjs', from: "  minDays: 7,", to: "  minDays: 0,", desc: 'retencja zero dni, nagrania znikają przed przetworzeniem' },
  { rule: 'R17-retention', file: 'voice.contract.mjs', from: "  setBy: ['org_admin:own', 'super_admin'],", to: "  setBy: ['org_admin:own', 'super_admin', 'nurse:own'],", desc: 'pielęgniarka zmienia retencję nagrań' },
  { rule: 'R17-retention', file: 'roles.contract.mjs', from: "create: ['org_admin:own', 'super_admin'], update: ['org_admin:own', 'super_admin'], delete: [] },", to: "create: ['org_admin:own', 'super_admin'], update: ['org_admin:own', 'super_admin', 'nurse:own'], delete: [] },", desc: 'macierz daje pielęgniarce zmianę retencji' },
  { rule: 'R34-device-ingest', file: 'integration.contract.mjs', from: "body: ['client_capture_id', 'sha256'],", to: "body: ['client_capture_id', 'sha256', 'resident_id'],", desc: 'COMMIT wysyła resident_id' },
  { rule: 'R34-device-ingest', file: 'integration.contract.mjs', from: "responses: ['ACCEPTED', 'DUPLICATE', 'DEVICE_REVOKED', 'HASH_MISMATCH', 'RETRY_LATER'] },", to: "responses: ['ACCEPTED', 'SAVED', 'DUPLICATE', 'DEVICE_REVOKED', 'HASH_MISMATCH', 'RETRY_LATER'] },", desc: 'żądanie zwraca kod spoza kontraktu' },
  { rule: 'R34-device-ingest', file: 'integration.contract.mjs', from: "  storedAs: 'token_hash',", to: "  storedAs: 'token',", desc: 'token urządzenia jawnie w bazie' },
  { rule: 'R34-device-ingest', file: 'integration.contract.mjs', from: "forbidden: ['resident_id', 'resident_name', 'pesel', 'transcript'],", to: "forbidden: ['resident_name', 'pesel', 'transcript'],", desc: 'urządzenie wysyła resident_id' },
  { rule: 'R34-device-ingest', file: 'integration.contract.mjs', from: "{ code: 'DEVICE_REVOKED', http: 401, deviceMayDelete: false,", to: "{ code: 'DEVICE_REVOKED', http: 401, deviceMayDelete: true,", desc: 'unieważnione urządzenie kasuje nieprzyjęte nagrania' },
  { rule: 'R34-device-ingest', file: 'integration.contract.mjs', from: "  idempotencyKey: ['device_id', 'client_capture_id'],", to: "  idempotencyKey: ['device_id'],", desc: 'ponowna wysyłka tworzy drugi wpis' },
  { rule: 'R34-device-ingest', file: 'integration.contract.mjs', from: "      always: ['code', 'server_time'],", to: "      always: ['code'],", desc: 'odpowiedzi bez czasu serwera' },
  { rule: 'R34-device-ingest', file: 'integration.contract.mjs', from: "    uncertainStates: ['UNKNOWN'],", to: "    uncertainStates: [],", desc: 'nagranie po utracie zasilania bez TIME_UNCERTAIN' },
  { rule: 'R34-device-ingest', file: 'integration.contract.mjs', from: "'session_seq', 'recorded_at', 'clock_state', 'age_ms', 'duration_ms', 'sha256', 'size_bytes', 'codec', 'firmware_version'], responses", to: "'session_seq', 'recorded_at', 'age_ms', 'duration_ms', 'sha256', 'size_bytes', 'codec', 'firmware_version'], responses", desc: 'INIT bez stanu zegara' },
  { rule: 'R34-device-ingest', file: 'integration.contract.mjs', from: "body: ['client_capture_id', 'session_id', 'session_seq',", to: "body: ['client_capture_id', 'session_seq',", desc: 'INIT bez sesji — autor nie do ustalenia' },
  { rule: 'R34-device-ingest', file: 'integration.contract.mjs', from: "    matchedBy: 'server',\n    llmIdentifies: false,", to: "    matchedBy: 'server',\n    llmIdentifies: true,", desc: 'model AI ustala autora z nagrania' },
  { rule: 'R34-device-ingest', file: 'integration.contract.mjs', from: "    ambiguousResolvedBy: ['nurse:shift_lead', 'org_admin:own'],", to: "    ambiguousResolvedBy: ['system'],", desc: 'niejednoznaczny autor wybierany automatycznie' },
  { rule: 'R34-device-ingest', file: 'integration.contract.mjs', from: '    sessionInactivityTimeoutMinutes: 180,', to: '    sessionInactivityTimeoutMinutes: 0,', desc: 'brak timeoutu bezczynności sesji skleja brudnopisy dwóch osób' },
  { rule: 'R34-device-ingest', file: 'integration.contract.mjs', from: "    outOfOrderPolicy: 'RETROACTIVE_ON_SEQ_1',", to: "    outOfOrderPolicy: 'IGNORE_BEFORE_SEQ_1',", desc: 'nagrania spoza kolejności przy retry nie dostają retroaktywnie autora' },
  { rule: 'R09-human-approval', file: 'voice.contract.mjs', from: "{ id: 'APPROVE',   actor: 'nurse',", to: "{ id: 'APPROVE',   actor: 'llm',", desc: 'model publikuje raport bez człowieka' },
  { rule: 'R10-no-metric-alarm', file: 'notifications.contract.mjs', from: "{ id: 'F1', domain: 'FAMILY', trigger: 'daily_report_published'", to: "{ id: 'F1', domain: 'FAMILY', trigger: 'steps_below_threshold'", desc: 'alarm o spadku liczby kroków do rodziny' },
  { rule: 'R11-notif-shape', file: 'notifications.contract.mjs', from: "req: ['NTF-REPORT-READY', 'NTF-NO-PII'], status: 'STABLE'", to: "req: ['NTF-NIEISTNIEJACE'], status: 'STABLE'", desc: 'powiadomienie wskazuje nieistniejące wymaganie' },
  { rule: 'R12-rbac', file: 'roles.contract.mjs', from: "{ resource: 'residents',               read: ['org_admin:own', 'nurse:own']", to: "{ resource: 'residents',               read: ['org_admin:own', 'opiekun:own']", desc: 'nieistniejąca rola w macierzy' },
  { rule: 'R13-draft-isolation', file: 'roles.contract.mjs', from: "{ resource: 'daily_logs',              read: ['nurse:own', 'org_admin:own'],", to: "{ resource: 'daily_logs',              read: ['nurse:own', 'org_admin:own', 'family:own'],", desc: 'rodzina czyta brudnopis z danymi medycznymi' },
  { rule: 'R14-audit-append-only', file: 'roles.contract.mjs', from: "{ resource: 'audit_logs',              read: ['super_admin', 'org_admin:own'],            create: ['org_admin'],    update: [],", to: "{ resource: 'audit_logs',              read: ['super_admin', 'org_admin:own'],            create: ['org_admin'],    update: ['super_admin'],", desc: 'super admin edytuje rejestr audytowy' },
  { rule: 'R15-mfa-scope', file: 'roles.contract.mjs', from: "export const MFA_REQUIRED_ROLES = ['super_admin', 'org_admin', 'nurse'];", to: "export const MFA_REQUIRED_ROLES = ['super_admin', 'org_admin'];", desc: 'pielęgniarka bez drugiego składnika' },
  { rule: 'R16-ingest-guard', file: 'integration.contract.mjs', from: "{ id: 'active_consent',   desc: 'Aktywna zgoda na cel wellness_data_ingest w consent_ledger.', onFail: 'REJECT_AND_LOG' },", to: "", desc: 'ingest bez sprawdzania zgody' },
  { rule: 'R18-vocabulary', file: 'presentation.contract.mjs', from: "{ term: 'pacjent',  replacement: 'podopieczny / senior / pensjonariusz', reason: 'MDR — nomenklatura medyczna sugeruje leczenie, nie opiekę.' },", to: "", desc: 'zakaz słowa „pacjent" usunięty' },
  { rule: 'R19-req-shape', file: 'requirements.contract.mjs', from: "R('FAM-AGENDA', { source: 'SC-FAM-06', domain: 'family',", to: "R('FAM-AGENDA', { source: 'SC-FAM-06',", desc: 'wymaganie bez domeny' },
  { rule: 'R20-high-risk-testable', file: 'requirements.contract.mjs', from: "acceptance: ['Wiadomość zawiera wyłącznie zachętę do otwarcia portalu', 'Brak imienia, nazwiska i jakiejkolwiek metryki w treści', 'Test sprawdza szablony, nie tylko pojedynczą wysyłkę'], risk: 'HIGH' }", to: "acceptance: ['Bez PII'], risk: 'HIGH' }", desc: 'kryterium wysokiego ryzyka zbyt ogólne' },
  { rule: 'R22-transfer-exception', file: 'integration.contract.mjs', from: "exceptionApprovedBy: 'Michal, 2026-08-27',", to: "", desc: 'dostawca poza EOG bez odnotowanej zgody na wyjątek' },
  { rule: 'R23-autonomy-limits', file: 'autonomy.contract.mjs', from: "  { id: 'mdr_boundary',         desc: 'Zmiana zakresu danych widocznych bliskim albo klasyfikacji pola jako behawioralne/fizjologiczne.', reason: 'Decyduje o klasyfikacji produktu jako wyrobu medycznego. Nieodwracalna reputacyjnie i prawnie.' },\n", to: "", desc: 'agent sam decyduje o granicy MDR' },
  { rule: 'R24-design-a11y', file: 'design.contract.mjs', from: "  baseSize: '14px',", to: "  baseSize: '12px',", desc: 'tekst zmniejszony poniżej progu czytelności (minimum 14px, ADR-020)' },
  { rule: 'R19-req-shape', file: 'requirements.contract.mjs', from: "deferredUntil: 'Decyzja o skalowaniu poza pilotaż (Michał) albo pierwszy incydent wymagający odtworzenia stanu bazy co do sekundy.', risk: 'MEDIUM' }),", to: "risk: 'MEDIUM' }),", desc: 'status DEFERRED bez deferredUntil — odłożone bezterminowo' },
  { rule: 'R24-design-a11y', file: 'design.contract.mjs', from: "'chart-3':                { value: '#878787',", to: "'chart-3':                { value: '#D4D4D4',", desc: 'seria wykresu poniżej kontrastu 3:1 (WCAG 1.4.11)' },
  { rule: 'R25-occupancy-integrity', file: 'facility.contract.mjs', from: "{ id: 'bed_single_occupant', desc: 'Przypisanie do łóżka z aktywnym przypisaniem innej osoby jest odrzucane, nie nadpisywane.', onViolation: 'REJECT' },", to: "{ id: 'bed_single_occupant', desc: 'Przypisanie do łóżka z aktywnym przypisaniem innej osoby jest odrzucane, nie nadpisywane.', onViolation: 'OVERWRITE' },", desc: 'podwójne przypisanie łóżka ciche nadpisanie zamiast odrzucenia' },
  { rule: 'R26-resident-card', file: 'presentation.contract.mjs', from: "{ id: 'family',   label: 'Bliscy i kontakty',   roles: ['org_admin'],", to: "{ id: 'family',   label: 'Bliscy i kontakty',   roles: ['org_admin', 'nurse'],", desc: 'pielęgniarka w sekcji bliskich mimo braku odczytu resident_relative_links' },
  { rule: 'R26-resident-card', file: 'presentation.contract.mjs', from: "{ id: 'overview', label: 'Przegląd',            roles: ['org_admin', 'nurse'],", to: "{ id: 'overview', label: 'Przegląd',            roles: ['org_admin', 'nurse', 'family'],", desc: 'karta podopiecznego przyznana rodzinie (rola spoza personelu)' },
  { rule: 'R26-resident-card', file: 'presentation.contract.mjs', from: "resources: ['wellness_daily'], metricKind: 'BEHAVIORAL' }", to: "resources: ['wellness_daily'], metricKind: 'PHYSIOLOGICAL' }", desc: 'karta prezentuje metryki fizjologiczne' },
  { rule: 'R26-resident-card', file: 'presentation.contract.mjs', from: "{ id: 'manage',   label: 'Edycja i wypis',      roles: ['org_admin'],", to: "{ id: 'manage',   label: 'Edycja i wypis',      roles: ['org_admin', 'nurse'],", desc: 'pielęgniarka z akcjami zapisu bez uprawnienia update do residents' },
  { rule: 'R27-role-labels', file: 'roles.contract.mjs', from: "label: 'Kierownik placówki',", to: "label: 'Kierownik placówki (org_admin)',", desc: 'etykieta roli z identyfikatorem technicznym w nawiasie' },
  { rule: 'R27-role-labels', file: 'roles.contract.mjs', from: "label: 'Personel opiekuńczy',", to: "label: 'Nurse',", desc: 'etykieta roli po angielsku' },
  { rule: 'R27-role-labels', file: 'roles.contract.mjs', from: "{ id: 'family', label: 'Członek rodziny',", to: "{ id: 'family',", desc: 'rola bez etykiety' },
  { rule: 'R27-role-labels', file: 'roles.contract.mjs', from: "label: 'Opiekun prawny',", to: "label: 'Członek rodziny',", desc: 'dwie role z tą samą etykietą' },
  { rule: 'R28-agenda-no-medical', file: 'presentation.contract.mjs', from: "excludedTypes: ['medication'],", to: "excludedTypes: [],", desc: 'typ medication trafia do planu dnia rodziny' },
  { rule: 'R28-agenda-no-medical', file: 'presentation.contract.mjs', from: "    vital_sign:      ['ciśnieni', 'cukru', 'cukier', 'glukoz', 'glikemi', 'ekg', 'saturacj', 'tętn', 'pomiar'],\n", to: "", desc: 'kategoria MEDICAL (parametry życiowe) bez słów — pomiary trafiłyby do rodziny' },
  { rule: 'R28-agenda-no-medical', file: 'presentation.contract.mjs', from: "'diagnoz', 'rozpoznani'", to: "'diagnoz', 'le'", desc: 'za krótkie słowo ukrywałoby niemedyczne pozycje' },
  { rule: 'R29-capacity-policy', file: 'facility.contract.mjs', from: "  setBy: ['super_admin'],", to: "  setBy: ['super_admin', 'org_admin'],", desc: 'kierownik ustawia limit miejsc sam sobie' },
  { rule: 'R29-capacity-policy', file: 'facility.contract.mjs', from: "  autoRaise: false,", to: "  autoRaise: true,", desc: 'limit miejsc rośnie po cichu przy imporcie' },
  { rule: 'R29-capacity-policy', file: 'facility.contract.mjs', from: "notify: ['A4', 'A5']", to: "notify: ['A4']", desc: 'super admin nie dowiaduje się o przekroczeniu limitu' },
  { rule: 'R30-ui-terminology', file: 'presentation.contract.mjs', from: "{ entity: 'role:org_admin', preferred: 'Kierownik placówki',", to: "{ entity: 'role:org_admin', preferred: 'Administrator Ośrodka',", desc: 'nazwa roli w słowniku niezgodna z ROLES.label' },
  { rule: 'R30-ui-terminology', file: 'presentation.contract.mjs', from: "preferred: 'placówka',             forbidden: ['ośrodek',", to: "preferred: 'ośrodek',             forbidden: ['ośrodek',", desc: 'termin jednocześnie preferowany i zakazany' },
  { rule: 'R31-shift-lead', file: 'roles.contract.mjs', from: "create: ['org_admin:own', 'nurse:shift_lead'], update: [], delete: [] },", to: "create: ['org_admin:own', 'family:shift_lead'], update: [], delete: [] },", desc: 'zakres kierownika zmiany dla roli bliskich' },
  { rule: 'R31-shift-lead', file: 'roles.contract.mjs', from: "update: ['org_admin:own', 'nurse:shift_lead'], delete: [] },", to: "update: ['org_admin:own', 'nurse:shift_lead'], delete: [] },\n  { resource: 'residents_dup', read: ['nurse:shift_lead'], create: [], update: [], delete: [] },", desc: 'odczyt i obcy zasób z zakresem kierownika zmiany' },
  { rule: 'R31-shift-lead', file: 'roles.contract.mjs', from: "  leadsPerShift: 1,\n  identity:", to: "  leadsPerShift: 2,\n  identity:", desc: 'dwóch kierowników na jedną zmianę' },
  { rule: 'R32-shift-tasks', file: 'facility.contract.mjs', from: "  cancelRequiresReason: true,", to: "  cancelRequiresReason: false,", desc: 'zadanie anulowane bez powodu' },
  { rule: 'R32-shift-tasks', file: 'facility.contract.mjs', from: "  visibleToRelatives: false,", to: "  visibleToRelatives: true,", desc: 'zadania zmiany widoczne dla bliskich' },
  { rule: 'R32-shift-tasks', file: 'facility.contract.mjs', from: "printFields: ['resident_name',", to: "printFields: ['pesel', 'resident_name',", desc: 'PESEL na wydruku planu pracy' },
  { rule: 'R32-shift-tasks', file: 'roles.contract.mjs', from: "{ resource: 'shift_tasks',             read: ['org_admin:own', 'nurse:own'],", to: "{ resource: 'shift_tasks',             read: ['org_admin:own', 'nurse:own', 'family:own'],", desc: 'rodzina czyta zadania zmiany' },
  { rule: 'R32-shift-tasks', file: 'facility.contract.mjs', from: "settlementPaths: ['DONE', 'CANCELLED', 'CARRIED'],", to: "settlementPaths: ['DONE', 'CANCELLED'],", desc: 'niewykonane zadanie znika zamiast przejść na kolejną zmianę' },
  { rule: 'R28-agenda-no-medical', file: 'requirements.contract.mjs', from: "'Widok rodziny nie ma kategorii leków'], risk: 'HIGH' }),", to: "'Widok rodziny nie ma kategorii leków'], risk: 'MEDIUM' }),", desc: 'granica MDR obniżona do ryzyka MEDIUM' },
  { rule: 'R21-send-window', file: 'notifications.contract.mjs', from: "SMS: '08:00-20:00'", to: "SMS: '00:00-23:59'", desc: 'SMS o raporcie wysyłany w nocy' },
  { rule: 'R35-feature-flags', file: 'features.contract.mjs', from: "    key: 'module_facility_management',\n    kind: 'module',\n    label: 'Zarządzanie placówką',\n    description: 'Struktura placówki (piętra, sektory, pokoje, łóżka, reguły przydziału), limity miejsc, personel oraz ustawienia placówki.',\n    defaultEnabled: true,\n    dependsOn: [],", to: "    key: 'module_facility_management',\n    kind: 'module',\n    label: 'Zarządzanie placówką',\n    description: 'Struktura placówki (piętra, sektory, pokoje, łóżka, reguły przydziału), limity miejsc, personel oraz ustawienia placówki.',\n    defaultEnabled: true,\n    dependsOn: ['module_finance_budget'],", desc: 'cykl zależności w grafie dependsOn modułów' },
  { rule: 'R35-feature-flags', file: 'features.contract.mjs', from: "    key: 'module_audit_compliance',\n    kind: 'module',\n    label: 'Rozszerzone audytowanie aktywności',\n    description: 'Szczegółowy ślad kroków użytkowników i wyświetleń raportów oraz rozszerzona analityka audytowa w placówce (obok niewyłączalnego rejestru RODO).',\n    defaultEnabled: false,\n    dependsOn: [],", to: "    key: 'module_audit_compliance',\n    kind: 'module',\n    label: 'Rozszerzone audytowanie aktywności',\n    description: 'Szczegółowy ślad kroków użytkowników i wyświetleń raportów oraz rozszerzona analityka audytowa w placówce (obok niewyłączalnego rejestru RODO).',\n    defaultEnabled: false,\n    dependsOn: ['module_nieistniejacy'],", desc: 'odwołanie do nieistniejącego modułu w dependsOn' },
  { rule: 'R35-feature-flags', file: 'features.contract.mjs', from: "    key: 'allow_org_admin_report_config',\n    kind: 'delegation',\n    label: 'Konfiguracja raportów przez Kierownika placówki',\n    description: 'Deleguje do Kierownika placówki możliwość konfigurowania aktywnych typów i parametrów raportów operacyjnych własnej placówki.',\n    defaultEnabled: false,", to: "    key: 'allow_org_admin_report_config',\n    kind: 'delegation',\n    label: 'Konfiguracja raportów przez Kierownika placówki',\n    description: 'Deleguje do Kierownika placówki możliwość konfigurowania aktywnych typów i parametrów raportów operacyjnych własnej placówki.',\n    defaultEnabled: true,", desc: 'flaga delegacji domyślnie włączona dla wszystkich placówek' },
  { rule: 'R35-feature-flags', file: 'features.contract.mjs', from: "    key: 'allow_org_admin_contract_templates',\n    kind: 'delegation',\n    label: 'Szablony umów przez Kierownika placówki',\n    description: 'Deleguje do Kierownika placówki możliwość tworzenia i wersjonowania szablonów umów własnej placówki.',\n    defaultEnabled: false,\n    dependsOn: ['module_documents_contracts'],", to: "    key: 'allow_org_admin_contract_templates',\n    kind: 'delegation',\n    label: 'Szablony umów przez Kierownika placówki',\n    description: 'Deleguje do Kierownika placówki możliwość tworzenia i wersjonowania szablonów umów własnej placówki.',\n    defaultEnabled: false,\n    dependsOn: [],", desc: 'flaga delegacji bez zależności od modułu nadrzędnego' },
  { rule: 'R35-feature-flags', file: 'roles.contract.mjs', from: "{ resource: 'organization_feature_flags', read: ['super_admin', 'org_admin:own', 'nurse:own', 'legal_guardian:own', 'family:own'], create: ['super_admin'], update: ['super_admin'], delete: ['super_admin'] },", to: "{ resource: 'organization_feature_flags', read: ['super_admin', 'org_admin:own', 'nurse:own', 'legal_guardian:own', 'family:own'], create: ['super_admin'], update: ['super_admin', 'org_admin:own'], delete: ['super_admin'] },", desc: 'kierownik placówki zmienia własne flagi modułów' },
  { rule: 'R35-feature-flags', file: 'features.contract.mjs', from: '  blockImpersonation: true,', to: '  blockImpersonation: false,', desc: 'edycja flag możliwa w trybie impersonacji' },
  { rule: 'R35-feature-flags', file: 'features.contract.mjs', from: "  managedBy: ['super_admin'],", to: "  managedBy: ['super_admin', 'org_admin'],", desc: 'polityka dopuszcza org_admin do zarządzania flagami' },
  { rule: 'R35-feature-flags', file: 'features.contract.mjs', from: "  'mandatory_rodo_audit_logs',\n", to: '', desc: 'obowiązkowy audyt RODO usunięty z niewyłączalnego Rdzenia' },
  { rule: 'R35-feature-flags', file: 'features.contract.mjs', from: "  'auth_sessions',\n", to: '', desc: 'element auth_sessions usunięty z niewyłączalnego Rdzenia' },
  { rule: 'R35-feature-flags', file: 'features.contract.mjs', from: "  {\n    key: 'allow_org_admin_report_config',\n    kind: 'delegation',\n    label: 'Konfiguracja raportów przez Kierownika placówki',\n    description: 'Deleguje do Kierownika placówki możliwość konfigurowania aktywnych typów i parametrów raportów operacyjnych własnej placówki.',\n    defaultEnabled: false,\n    dependsOn: ['module_voice_and_reports'],\n    routes: [],\n    apiPrefixes: [],\n  },\n", to: '', desc: 'usunięta delegacja allow_org_admin_report_config z katalogu' },
  { rule: 'R35-feature-flags', file: 'features.contract.mjs', from: "    apiPrefixes: ['/api/voice'],", to: "    apiPrefixes: 123,", desc: 'pole apiPrefixes ustawione jako liczba zamiast tablicy' },
  { rule: 'R35-feature-flags', file: 'features.contract.mjs', from: "    routes: ['/admin/budget'],", to: "    routes: 'admin/budget',", desc: 'pole routes ustawione jako string zamiast tablicy ścieżek' },
  { rule: 'R35-feature-flags', file: 'features.contract.mjs', from: "      '/api/residents/[id]/report/latest',\n", to: '', desc: 'usunięty endpoint /api/residents/[id]/report/latest z module_family_portal' },
  { rule: 'R35-feature-flags', file: 'features.contract.mjs', from: "  writePathPolicy: 'RPC_ONLY',", to: "  writePathPolicy: 'DIRECT_RLS',", desc: 'zapis flag poza wyłącznym RPC' },
  { rule: 'R35-feature-flags', file: 'features.contract.mjs', from: "  multiFlagRoutePolicy: 'REQUIRE_ALL_MATCHING',", to: "  multiFlagRoutePolicy: 'FIRST_MATCH',", desc: 'osłabiona reguła tras wieloflagowych' },
];

const results = [];
for (const mut of MUTATIONS) {
  const tmp = mkdtempSync(join(tmpdir(), 'sc-selftest-'));
  try {
    cpSync(join(ROOT, 'contracts'), join(tmp, 'contracts'), { recursive: true });
    cpSync(join(ROOT, 'tools'), join(tmp, 'tools'), { recursive: true });
    const target = join(tmp, 'contracts', mut.file);
    const before = readFileSync(target, 'utf8');
    if (!before.includes(mut.from)) {
      results.push({ ...mut, ok: false, why: 'wzorzec mutacji nie pasuje do kontraktu — mutacja jest nieaktualna' });
      continue;
    }
    writeFileSync(target, before.replace(mut.from, mut.to));
    let blocked = false;
    try {
      execFileSync('node', [join(tmp, 'tools', 'sc-validate.mjs')], { env: { ...process.env, SC_PROJECT_DIR: tmp }, stdio: 'pipe' });
    } catch {
      blocked = true;
    }
    results.push({ ...mut, ok: blocked, why: blocked ? '' : 'walidator przepuścił zepsuty kontrakt' });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('\n  Test mutacyjny bramki Silver Care\n');
let dead = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`  ✓ ${r.rule.padEnd(28)} zablokowała: ${r.desc}`);
  } else {
    console.log(`  ✗ ${r.rule.padEnd(28)} MARTWA — ${r.why}`);
    dead++;
  }
}
console.log(`\n  Wynik: ${results.length - dead}/${results.length} reguł udowodniło, że potrafi zablokować zmianę.`);
if (dead) {
  console.log('  ✗ Martwe reguły dają fałszywe poczucie ochrony.\n');
  process.exit(1);
}
console.log('  ✓ Każda reguła bramki jest żywa.\n');
