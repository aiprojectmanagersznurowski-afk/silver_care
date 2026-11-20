/**
 * voice.contract.mjs — potok notatek głosowych.
 *
 * ŹRÓDŁO PRAWDY dla asystenta głosowego i generowania raportu dla bliskich.
 *
 * Dwa rozstrzygnięcia, które kształtują cały potok:
 *
 * ADR-006 (zero-guessing): model nigdy nie ustala tożsamości pensjonariusza
 * z nagrania. Frontend wysyła twardy UUID, transkrypt idzie do LLM anonimowy,
 * a złączenie następuje w pamięci funkcji brzegowej przed zapisem.
 *
 * ADR-007 (separacja przed LLM): dane medyczne są usuwane z transkryptu ZANIM
 * trafi do modelu, nie po. Model generujący raport dla rodziny nigdy nie widzi
 * nazwy leku. To zaostrzenie wobec pierwotnych user stories, które mówiły tylko,
 * że lek „ląduje w brudnopisie".
 *
 * ADR-022 (kanał urządzeń, 2026-11-17): nagranie z urządzenia (ekran tylko ze stanem) przychodzi
 * bez resident_id. Tożsamość nadal nie pochodzi z modelu: serwer podsuwa kandydatów
 * z rejestru placówki, człowiek potwierdza na etapie ASSIGN, a bez potwierdzenia
 * nagranie nie przechodzi do CLASSIFY.
 */

/** Trzy strumienie, na jakie rozdziela się transkrypt. Kolejność ma znaczenie. */
export const TRANSCRIPT_STREAMS = [
  {
    id: 'MEDICAL',
    order: 1,
    destination: 'daily_logs.raw_data',
    reachesLLM: false,
    audience: ['nurse', 'org_admin'],
    desc: 'Leki, diagnozy, wyniki badań, parametry życiowe zestawiane w celu oceny kondycji.',
    rule: 'Usuwane z transkryptu PRZED wysłaniem do LLM. Zapisywane wyłącznie w brudnopisie personelu.',
  },
  {
    id: 'DISCOMFORT',
    order: 2,
    destination: 'daily_logs.raw_data + daily_reports.draft',
    reachesLLM: true,
    audience: ['nurse', 'org_admin'],
    desc: 'Zdarzenia naruszające godność: wymioty, biegunka, nietrzymanie.',
    rule: 'Oryginał zostaje w brudnopisie. Do raportu trafia wyłącznie ogólny opis dyskomfortu.',
  },
  {
    id: 'BEHAVIORAL',
    order: 3,
    destination: 'daily_reports.draft',
    reachesLLM: true,
    audience: ['nurse', 'org_admin', 'legal_guardian', 'family'],
    desc: 'Zachowanie, nastrój, apetyt, udział w zajęciach.',
    rule: 'Podstawa raportu dla bliskich.',
  },
];

/**
 * Kategorie danych medycznych wg definicji z art. 4 pkt 15 i art. 9 RODO (ADR-007).
 * Wykrycie którejkolwiek kieruje fragment do strumienia MEDICAL.
 */
export const MEDICAL_CATEGORIES = [
  { id: 'medication',      desc: 'Nazwy leków, dawki, pory podania, plany terapeutyczne.' },
  { id: 'diagnosis',       desc: 'Rozpoznania, historie chorób, jednostki chorobowe.' },
  { id: 'test_result',     desc: 'Wyniki badań laboratoryjnych i obrazowych.' },
  { id: 'vital_sign',      desc: 'Ciśnienie, poziom cukru, EKG, saturacja — parametry oceniające kondycję organizmu.' },
  { id: 'clinical_advice', desc: 'Zalecenia lekarskie, zmiany terapii.' },
];

/** Etapy potoku. Każdy ma jawne wejście i wyjście — brak etapu „AI decyduje". */
export const PIPELINE_STAGES = [
  { id: 'CAPTURE',   actor: 'nurse',        input: 'audio + resident_id (UUID) z aplikacji albo audio z urządzenia bez resident_id', output: 'voice_draft_notes', desc: 'Nagranie z jednego ze źródeł CAPTURE_SOURCES. Tożsamość nigdy nie pochodzi z treści nagrania.' },
  { id: 'TRANSCRIBE', actor: 'system',      input: 'audio',                      output: 'transkrypt tekstowy', desc: 'Transkrypcja bez kontekstu tożsamości.' },
  { id: 'ASSIGN',    actor: 'nurse',        input: 'transkrypt + kandydaci z dopasowania serwera', output: 'resident_id (UUID) potwierdzony przez człowieka albo zakres placówki', desc: 'Tylko nagrania bez resident_id (RESIDENT_ASSIGNMENT). Serwer podsuwa, człowiek potwierdza. Bez potwierdzenia brak przejścia do CLASSIFY.' },
  { id: 'CLASSIFY',  actor: 'system',       input: 'transkrypt',                 output: 'trzy strumienie',   desc: 'Rozdział na MEDICAL / DISCOMFORT / BEHAVIORAL przed wejściem do LLM.' },
  { id: 'REDACT',    actor: 'system',       input: 'strumień MEDICAL',           output: 'transkrypt bez danych medycznych', desc: 'Usunięcie fragmentów medycznych. Nieodwracalne dla ścieżki LLM.' },
  { id: 'GENERATE',  actor: 'llm',          input: 'transkrypt zredagowany, anonimowy', output: 'draft raportu', desc: 'Model nie zna tożsamości i nie widzi danych medycznych.' },
  { id: 'REJOIN',    actor: 'edge_function', input: 'draft + resident_id',       output: 'daily_reports (draft)', desc: 'Złączenie z tożsamością w pamięci, przed zapisem.' },
  { id: 'APPROVE',   actor: 'nurse',        input: 'draft',                      output: 'daily_reports (published)', desc: 'Publikacja wymaga człowieka. Dopiero wtedy RLS odsłania raport bliskim.' },
];

/**
 * Źródła nagrań (ADR-022). `residentId` mówi, kiedy znany jest podopieczny:
 * AT_CAPTURE — UUID w żądaniu z frontendu, brak kończy się odmową;
 * AT_ASSIGN — nagranie bez podopiecznego, potwierdzenie człowieka na etapie ASSIGN.
 * Innych sposobów nie ma: tożsamość nie pochodzi z modelu ani z samej treści nagrania.
 */
export const CAPTURE_SOURCES = [
  { id: 'APP',    residentId: 'AT_CAPTURE', author: 'Sesja zalogowanego użytkownika', desc: 'Aplikacja: podopieczny wybrany przed nagraniem (SC-NUR-02).' },
  { id: 'DEVICE', residentId: 'AT_ASSIGN',  author: 'Osoba z przedstawienia w pierwszym nagraniu sesji urządzenia (DEVICE_INGEST_PROTOCOL.authorship)', desc: 'Urządzenie z ekranem tylko ze stanem, bez treści nagrań i nazwisk, M5Stack StickS3 (SC-NUR-17).' },
];

/**
 * Przypisanie podopiecznego do nagrania bez resident_id (SC-NUR-18, ADR-022).
 * Kolejka jest osobnym zasobem: kierownik zmiany i kierownik placówki czytają wyłącznie
 * pozycje czekające na decyzję, a voice_draft_notes zostaje prywatne dla autora
 * (decyzja Michała z 2026-11-17).
 */
export const RESIDENT_ASSIGNMENT = {
  appliesTo: ['DEVICE'],
  queueResource: 'voice_assignment_queue',
  suggestedBy: 'server',
  llmIdentifies: false,
  matchOn: ['nazwisko podopiecznego', 'numer pokoju (rooms.number)', 'etykieta łóżka (beds.label)'],
  matchScope: 'Wyłącznie rejestr placówki, do której należy urządzenie.',
  confirmedBy: ['nurse:shift_lead', 'org_admin:own'],
  outcomes: ['RESIDENT', 'FACILITY', 'UNASSIGNABLE'],
  onUnconfirmed: 'HOLD_BEFORE_CLASSIFY',
  onUnassignable: 'Zostaje w brudnopisie personelu, nie trafia do modelu, podlega VOICE_RETENTION.',
  afterDecision: 'Pozycja znika z kolejki. Nagranie czyta dalej wyłącznie autor (voice_draft_notes, nurse:own).',
  oneRecordingOneResident: true,
  audit: 'audit_logs: kto, kiedy, kandydaci podsunięci przez serwer i wybór człowieka.',
  status: 'STABLE',
};

/**
 * Retencja surowych nagrań (SC-NUR-02/AC3 i AC4, decyzja Michała z 2026-11-17).
 * ttlDays to wartość domyślna. Placówka może ją zmienić w zakresie minDays–maxDays.
 * Po terminie znika plik i wiersz nagrania; zatwierdzone raporty i fakty w daily_logs zostają.
 */
export const VOICE_RETENTION = {
  table: 'voice_draft_notes',
  storageBucket: 'voice-recordings',
  ttlDays: 30,
  minDays: 7,
  maxDays: 90,
  scope: 'organization',
  settingsResource: 'voice_retention_settings',
  setBy: ['org_admin:own', 'super_admin'],
  deletes: ['plik nagrania w voice-recordings', 'wiersz voice_draft_notes', 'pozycja voice_assignment_queue tego nagrania'],
  keeps: ['daily_reports', 'daily_logs'],
  auditChange: true,
  enforcedBy: 'cron bazodanowy',
  status: 'STABLE',
};

/** Metadane pochodzenia treści AI, wymagane do audytu (SC-NUR-03/AC1). */
export const AI_PROVENANCE_FIELDS = ['ai_model', 'ai_prompt_version', 'ai_generated_at', 'approved_by', 'approved_at'];

/** Kategorie zgłoszeń błędu AI (SC-COMP-01/AC2). */
export const AI_FEEDBACK_CATEGORIES = ['medical_error', 'hallucination', 'privacy_violation', 'tone_violation', 'mdr_violation'];

/** Aktualna wersja promptów potoku głosu zgodna z MDR i EU DPA (Etap 6D). */
export const PROMPT_VERSION = 'v2.1.0-mdr-eu-dpa';

