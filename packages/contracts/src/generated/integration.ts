// WYGENEROWANE z contracts/ przez tools/sc-codegen.mjs — nie edytuj ręcznie.

export const PROVIDERS = [
  {
    "id": "POLAR",
    "kind": "WEARABLE",
    "status": "ACTIVE",
    "region": "EU_FINLAND",
    "auth": "OAUTH2",
    "desc": "Polar 360 przez AccessLink API. Dostawca referencyjny MVP."
  },
  {
    "id": "GARMIN",
    "kind": "WEARABLE",
    "status": "PLANNED",
    "region": "UNKNOWN",
    "auth": "OAUTH2",
    "desc": "Rozważany wariant zapasowy. Wymaga weryfikacji lokalizacji przetwarzania przed włączeniem."
  },
  {
    "id": "TERRA",
    "kind": "AGGREGATOR",
    "status": "PLANNED",
    "region": "UNKNOWN",
    "auth": "API_KEY",
    "desc": "Agregator wielu producentów. Uniezależnia od jednego dostawcy."
  },
  {
    "id": "GROQ",
    "kind": "TRANSCRIPTION",
    "status": "ACTIVE",
    "region": "US",
    "auth": "API_KEY",
    "transferMechanism": "SCC",
    "exceptionApprovedBy": "Michal, 2026-08-27",
    "exceptionReason": "Darmowy poziom (2000 żądań/dzień, 8h audio/dzień) eliminuje koszt transkrypcji w MVP dla piętnastu do dwudziestu pięciu pensjonariuszy. Umowa powierzenia istnieje, zerowa retencja dostępna do ręcznego włączenia. Wyjątek ograniczony do surowego audio przed redakcją — transkrypt zredagowany i wygenerowany raport zostają w infrastrukturze UE.",
    "requiresManualZeroRetentionToggle": true,
    "desc": "Whisper Large v3 Turbo przez GroqCloud. Transkrypcja surowego audio na etapie TRANSCRIBE, zanim transkrypt trafi do klasyfikatora strumieni."
  }
] as const;

export const WEARABLE_LINK = {
  "table": "external_wearable_links",
  "coreKey": "resident_id",
  "externalKeys": [
    "provider",
    "external_user_id",
    "external_device_id"
  ],
  "uniqueness": "Jedno AKTYWNE powiązanie na parę (resident_id, provider). Historia zachowana przez unlinked_at.",
  "desc": "Warstwa pośrednia: rdzeń nie wie, że istnieje Polar."
} as const;

export const ORG_LINK = {
  "table": "external_org_links",
  "coreKey": "organization_id",
  "externalKeys": [
    "provider",
    "external_org_id"
  ],
  "uniqueness": "Jedno aktywne powiązanie na parę (organization_id, provider).",
  "desc": "Obsługuje sieci placówek i systemy źródłowe używające własnego nazewnictwa (np. care_home)."
} as const;

export const FIELD_MAPPINGS = [
  {
    "canonical": "steps_total",
    "provider": "POLAR",
    "from": "activity.active_steps",
    "kind": "BEHAVIORAL",
    "familyVisible": true
  },
  {
    "canonical": "active_minutes",
    "provider": "POLAR",
    "from": "activity.duration (ISO 8601 → minuty)",
    "kind": "BEHAVIORAL",
    "familyVisible": true
  },
  {
    "canonical": "calories_total",
    "provider": "POLAR",
    "from": "activity.calories",
    "kind": "BEHAVIORAL",
    "familyVisible": false
  },
  {
    "canonical": "sleep_duration_min",
    "provider": "POLAR",
    "from": "sleep.sleep_end_time − sleep_start_time",
    "kind": "BEHAVIORAL",
    "familyVisible": true
  },
  {
    "canonical": "sleep_start_time",
    "provider": "POLAR",
    "from": "sleep.sleep_start_time",
    "kind": "BEHAVIORAL",
    "familyVisible": true
  },
  {
    "canonical": "sleep_end_time",
    "provider": "POLAR",
    "from": "sleep.sleep_end_time",
    "kind": "BEHAVIORAL",
    "familyVisible": true
  },
  {
    "canonical": "sleep_score",
    "provider": "POLAR",
    "from": "sleep.sleep_score",
    "kind": "PHYSIOLOGICAL",
    "familyVisible": false
  },
  {
    "canonical": "hrv_ms",
    "provider": "POLAR",
    "from": "nightly_recharge.heart_rate_variability_ms",
    "kind": "PHYSIOLOGICAL",
    "familyVisible": false
  },
  {
    "canonical": "resting_heart_rate_bpm",
    "provider": "POLAR",
    "from": "nightly_recharge.heart_rate_bpm",
    "kind": "PHYSIOLOGICAL",
    "familyVisible": false
  },
  {
    "canonical": "breathing_rate",
    "provider": "POLAR",
    "from": "nightly_recharge.breathing_rate",
    "kind": "PHYSIOLOGICAL",
    "familyVisible": false
  }
] as const;

export const INGEST_PRECONDITIONS = [
  {
    "id": "active_consent",
    "desc": "Aktywna zgoda na cel wellness_data_ingest w consent_ledger.",
    "onFail": "REJECT_AND_LOG"
  },
  {
    "id": "resident_active",
    "desc": "Pensjonariusz nie jest zarchiwizowany ani usunięty (SC-ADM-05/AC3).",
    "onFail": "REJECT_AND_LOG"
  },
  {
    "id": "link_active",
    "desc": "Istnieje aktywne powiązanie w external_wearable_links.",
    "onFail": "REJECT_AND_LOG"
  },
  {
    "id": "idempotency",
    "desc": "Ta sama paczka danych nie może utworzyć drugiego wiersza — klucz (resident_id, provider, date, metric).",
    "onFail": "UPSERT"
  }
] as const;

export const SYNC_STALENESS = {
  "thresholdHours": 6,
  "message": "Urządzenie obecnie poza zasięgiem huba",
  "kind": "INFORMATIONAL",
  "status": "STABLE"
} as const;

