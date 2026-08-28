/**
 * presentation.contract.mjs — co wolno pokazać bliskim i jakim językiem.
 *
 * ŹRÓDŁO PRAWDY dla warstwy prezentacji. To jest kontrakt, który trzyma system
 * poza definicją wyrobu medycznego (MDR) i poza interpretacją kliniczną.
 *
 * ADR-005 (wariant B): bliscy widzą metryki BEHAWIORALNE — kroki, długość snu,
 * czas aktywności. NIE widzą parametrów fizjologicznych: tętna, HRV, tętna
 * spoczynkowego. Granica biegnie tam, gdzie kończy się log zachowania,
 * a zaczyna parametr organizmu zestawiany w celu oceny kondycji.
 *
 * Dane fizjologiczne SĄ pobierane i przechowywane (ingest Polar jest w MVP),
 * ale zatrzymują się na warstwie personelu i nie mają ścieżki do portalu rodziny.
 */

/** Metryki dopuszczone do prezentacji bliskim. Lista ZAMKNIĘTA — allowlist, nie denylist. */
export const FAMILY_VISIBLE_METRICS = [
  { id: 'steps_total',        unit: 'kroki',   source: 'wellness_daily.steps_total',        kind: 'BEHAVIORAL', desc: 'Liczba kroków w ciągu dnia.' },
  { id: 'active_minutes',     unit: 'minuty',  source: 'wellness_daily.active_minutes',     kind: 'BEHAVIORAL', desc: 'Czas aktywności ruchowej.' },
  { id: 'sleep_duration_min', unit: 'minuty',  source: 'wellness_daily.sleep_duration_min', kind: 'BEHAVIORAL', desc: 'Długość snu.' },
  { id: 'sleep_start_time',   unit: 'godzina', source: 'wellness_daily.sleep_start_time',   kind: 'BEHAVIORAL', desc: 'Godzina zaśnięcia.' },
  { id: 'sleep_end_time',     unit: 'godzina', source: 'wellness_daily.sleep_end_time',     kind: 'BEHAVIORAL', desc: 'Godzina pobudki.' },
];

/**
 * Pola fizjologiczne. Zbierane i przechowywane, ale ZAKAZANE w warstwie rodziny.
 * Reguła bramki adr005-physio-leak blokuje ich użycie w apps/family/**.
 */
export const PHYSIOLOGICAL_FIELDS = [
  'heart_rate_bpm', 'resting_heart_rate_bpm', 'min_heart_rate_bpm', 'max_heart_rate_bpm',
  'avg_heart_rate_bpm', 'hrv_ms', 'breathing_rate', 'ans_charge', 'recovery_score',
  'sleep_score', 'nightly_recharge_status', 'continuity_class',
];

/**
 * Zakazane słownictwo w warstwie widocznej dla użytkownika (ADR-004).
 * Identyfikatory techniczne w bazie zostają po angielsku — zakaz dotyczy UI i treści.
 */
export const FORBIDDEN_UI_TERMS = [
  { term: 'pacjent',  replacement: 'podopieczny / senior / pensjonariusz', reason: 'MDR — nomenklatura medyczna sugeruje leczenie, nie opiekę.' },
  { term: 'patient',  replacement: 'resident', reason: 'To samo po angielsku. W bazie dozwolone wyłącznie jako historyczny alias w warstwie integracyjnej.' },
  { term: 'diagnoza', replacement: 'brak — nie stawiamy diagnoz', reason: 'MDR — diagnozowanie czyni system wyrobem medycznym.' },
  { term: 'objaw',    replacement: 'obserwacja', reason: 'MDR — język kliniczny.' },
  { term: 'terapia',  replacement: 'zajęcia / aktywność', reason: 'MDR — sugeruje leczenie.' },
];

/**
 * Guardrail MDR dla warstwy AI i powiadomień (ADR-005).
 * System opisuje FAKTY o zachowaniu. Nie ocenia stanu zdrowia i nie alarmuje.
 */
export const MDR_GUARDRAILS = {
  allowedStatements: [
    'Opis zaobserwowanego zachowania: „spacer w ogrodzie", „zjadł cały obiad".',
    'Obiektywna anomalia w harmonogramie: „brak aktywności od 4 godzin".',
    'Fakt o metryce behawioralnej: „spał 7 godzin 20 minut".',
  ],
  forbiddenStatements: [
    'Ocena stanu zdrowia: „czuje się słabiej", „kondycja się pogarsza".',
    'Sugestia kliniczna: „podejrzenie omdlenia", „możliwe odwodnienie".',
    'Alarm oparty na metryce: powiadomienie push przy spadku liczby kroków.',
    'Prognoza: „może to oznaczać początek infekcji".',
  ],
  /** Powiadomienia wychodzą WYŁĄCZNIE o dostępności raportu — nigdy o metryce. */
  notificationTriggers: ['daily_report_published'],
  intendedUse: 'Narzędzie komunikacji i organizacji codziennego życia placówki. Bez funkcji prewencyjnych, diagnostycznych i terapeutycznych.',
  status: 'STABLE',
};

/** Wymagane stany każdego komponentu prezentującego dane (NFR-UI-01). */
export const REQUIRED_UI_STATES = ['loading', 'empty', 'success', 'error'];

/** Etykieta wymagana przez EU AI Act na raporcie generowanym z udziałem AI (SC-NUR-03/AC3). */
export const AI_DISCLOSURE_LABEL = 'Podsumowanie generowane przy wsparciu AI, zatwierdzone przez personel placówki';
