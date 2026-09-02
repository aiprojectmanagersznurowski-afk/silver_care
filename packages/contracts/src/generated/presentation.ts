// WYGENEROWANE z contracts/ przez tools/sc-codegen.mjs — nie edytuj ręcznie.

export const FAMILY_VISIBLE_METRICS = [
  {
    "id": "steps_total",
    "unit": "kroki",
    "source": "wellness_daily.steps_total",
    "kind": "BEHAVIORAL",
    "desc": "Liczba kroków w ciągu dnia."
  },
  {
    "id": "active_minutes",
    "unit": "minuty",
    "source": "wellness_daily.active_minutes",
    "kind": "BEHAVIORAL",
    "desc": "Czas aktywności ruchowej."
  },
  {
    "id": "sleep_duration_min",
    "unit": "minuty",
    "source": "wellness_daily.sleep_duration_min",
    "kind": "BEHAVIORAL",
    "desc": "Długość snu."
  },
  {
    "id": "sleep_start_time",
    "unit": "godzina",
    "source": "wellness_daily.sleep_start_time",
    "kind": "BEHAVIORAL",
    "desc": "Godzina zaśnięcia."
  },
  {
    "id": "sleep_end_time",
    "unit": "godzina",
    "source": "wellness_daily.sleep_end_time",
    "kind": "BEHAVIORAL",
    "desc": "Godzina pobudki."
  }
] as const;

export const PHYSIOLOGICAL_FIELDS = [
  "heart_rate_bpm",
  "resting_heart_rate_bpm",
  "min_heart_rate_bpm",
  "max_heart_rate_bpm",
  "avg_heart_rate_bpm",
  "hrv_ms",
  "breathing_rate",
  "ans_charge",
  "recovery_score",
  "sleep_score",
  "nightly_recharge_status",
  "continuity_class"
] as const;

export const FORBIDDEN_UI_TERMS = [
  {
    "term": "pacjent",
    "replacement": "podopieczny / senior / pensjonariusz",
    "reason": "MDR — nomenklatura medyczna sugeruje leczenie, nie opiekę."
  },
  {
    "term": "patient",
    "replacement": "resident",
    "reason": "To samo po angielsku. W bazie dozwolone wyłącznie jako historyczny alias w warstwie integracyjnej."
  },
  {
    "term": "diagnoza",
    "replacement": "brak — nie stawiamy diagnoz",
    "reason": "MDR — diagnozowanie czyni system wyrobem medycznym."
  },
  {
    "term": "objaw",
    "replacement": "obserwacja",
    "reason": "MDR — język kliniczny."
  },
  {
    "term": "terapia",
    "replacement": "zajęcia / aktywność",
    "reason": "MDR — sugeruje leczenie."
  }
] as const;

export const MDR_GUARDRAILS = {
  "allowedStatements": [
    "Opis zaobserwowanego zachowania: „spacer w ogrodzie\", „zjadł cały obiad\".",
    "Obiektywna anomalia w harmonogramie: „brak aktywności od 4 godzin\".",
    "Fakt o metryce behawioralnej: „spał 7 godzin 20 minut\"."
  ],
  "forbiddenStatements": [
    "Ocena stanu zdrowia: „czuje się słabiej\", „kondycja się pogarsza\".",
    "Sugestia kliniczna: „podejrzenie omdlenia\", „możliwe odwodnienie\".",
    "Alarm oparty na metryce: powiadomienie push przy spadku liczby kroków.",
    "Prognoza: „może to oznaczać początek infekcji\"."
  ],
  "notificationTriggers": [
    "daily_report_published"
  ],
  "intendedUse": "Narzędzie komunikacji i organizacji codziennego życia placówki. Bez funkcji prewencyjnych, diagnostycznych i terapeutycznych.",
  "status": "STABLE"
} as const;

export const REQUIRED_UI_STATES = [
  "loading",
  "empty",
  "success",
  "error"
] as const;

export const AI_DISCLOSURE_LABEL = "Podsumowanie generowane przy wsparciu AI, zatwierdzone przez personel placówki" as const;

export type FamilyMetric = typeof FAMILY_VISIBLE_METRICS[number]['id'];
export type UIState = typeof REQUIRED_UI_STATES[number];

/** Strażnik czasu wykonania dla granicy MDR (ADR-005). */
export function assertFamilyVisible(field: string): void {
  if ((PHYSIOLOGICAL_FIELDS as readonly string[]).includes(field)) {
    throw new Error(`ADR-005: pole "${field}" jest parametrem fizjologicznym i nie może trafić do warstwy rodziny.`);
  }
}
