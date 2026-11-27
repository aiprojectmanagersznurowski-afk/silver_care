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
  },
  {
    "id": "GROQ_DEMO_LLM",
    "kind": "LLM_DEMO_INTERIM",
    "status": "ACTIVE",
    "region": "US",
    "auth": "API_KEY",
    "transferMechanism": "BRAK — DPA z Groq na CLASSIFY/GENERATE nie jest podpisane, w trakcie negocjacji (stan 2026-10-06). Patrz docs/REJESTR_PODMIOTOW_PRZETWARZAJACYCH.md.",
    "exceptionApprovedBy": "Michal, 2026-10-06; rozszerzenie na przekazanie zmiany: Michal, 2026-10-29 (ADR-021)",
    "exceptionReason": "Wyjątek na czas demonstracji i product discovery przed podpisaniem DPA. Od 2026-10-29 (ADR-021) obejmuje także przekazanie zmiany i propozycje zadań (HANDOVER_STRUCTURE, TASK_PROPOSE), łącznie z treścią MEDICAL z nagrania przekazania — wyłącznie ścieżka personelu, nigdy raport dla bliskich. Testy idą tą samą ścieżką kodu co produkcja, bez rozgałęzień „organizacja demo”. Dotyczy jedynie danych syntetycznych/testowych (w produkcyjnej bazie brak prawdziwych pensjonariuszy, potwierdzone 2026-10-29) — zakazane użycie z rzeczywistymi danymi pensjonariuszy do czasu ukończenia DPA albo przełączenia na model w UE. Wymaga jawnej zmiennej ALLOW_DEMO_GROQ_FALLBACK=true, niezależnej od GROQ_API_KEY używanego już do transkrypcji w wpisie GROQ powyżej.",
    "requiresManualZeroRetentionToggle": false,
    "demoOnly": true,
    "dpaStatus": "PENDING",
    "stages": [
      "CLASSIFY",
      "GENERATE",
      "HANDOVER_STRUCTURE",
      "TASK_PROPOSE"
    ],
    "desc": "llama-3.3-70b-versatile przez Groq OpenAI-compatible endpoint. Zamiennik CLASSIFY/GENERATE (ADR-015) oraz etapów przekazania zmiany HANDOVER_STRUCTURE/TASK_PROPOSE (ADR-021) przed podpisaniem DPA. Domyślnie wyłączony — nieaktywny bez ALLOW_DEMO_GROQ_FALLBACK=true. Dostawca wybierany konfiguracją, ta sama ścieżka kodu dla każdej organizacji."
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

export const DEVICE_AUTH = {
  "device": "M5Stack StickS3 (SKU K150)",
  "credential": "Token per urządzenie, pokazywany jeden raz przy rejestracji",
  "header": "X-Device-Token",
  "storedAs": "token_hash",
  "revocation": "voice_devices.revoked_at — unieważniony token dostaje odmowę, nagrania zostają zaszyfrowane na urządzeniu",
  "grants": [
    "voice_upload"
  ],
  "sessionAccess": false,
  "serviceRoleOnDevice": false,
  "status": "STABLE"
} as const;

export const DEVICE_INGEST_PROTOCOL = {
  "version": "1.2.0",
  "endpoint": "/api/voice/device",
  "runtime": "Next.js, Vercel fra1",
  "storageRegion": "EU",
  "steps": [
    {
      "id": "INIT",
      "desc": "Urządzenie wysyła token i metadane nagrania. Serwer zwraca podpisany adres zapisu w Storage albo DUPLICATE, jeśli nagranie już przyjęto."
    },
    {
      "id": "UPLOAD",
      "desc": "Urządzenie wysyła plik prosto do Storage pod podpisany adres."
    },
    {
      "id": "COMMIT",
      "desc": "Serwer ponownie uwierzytelnia urządzenie, sprawdza rozmiar i SHA-256 pliku oraz zapisuje nagranie w voice_captures ze źródłem DEVICE. Potok asynchroniczny transkrybuje i przypisuje fragmenty; wyjątki trafiają do kolejki „Do przypisania”."
    }
  ],
  "idempotencyKey": [
    "device_id",
    "client_capture_id"
  ],
  "fields": {
    "required": [
      "client_capture_id",
      "session_id",
      "session_seq",
      "recorded_at",
      "clock_state",
      "age_ms",
      "duration_ms",
      "sha256",
      "size_bytes",
      "codec",
      "firmware_version"
    ],
    "forbidden": [
      "resident_id",
      "resident_name",
      "pesel",
      "transcript"
    ],
    "formats": {
      "session_id": "UUID v4 (string), unikalny dla sesji urządzenia",
      "session_seq": "liczba całkowita >= 1 (integer), numer nagrania w obrębie sesji (1 = przedstawienie)",
      "age_ms": "liczba całkowita >= 0 (integer), czas w milisekundach od nagrania do INIT (0 przy UNKNOWN)"
    }
  },
  "codecs": [
    "IMA_ADPCM_WAV",
    "OPUS"
  ],
  "wire": {
    "contentType": "application/json",
    "requests": [
      {
        "step": "INIT",
        "method": "POST",
        "path": "/api/voice/device",
        "body": [
          "client_capture_id",
          "session_id",
          "session_seq",
          "recorded_at",
          "clock_state",
          "age_ms",
          "duration_ms",
          "sha256",
          "size_bytes",
          "codec",
          "firmware_version"
        ],
        "responses": [
          "UPLOAD_URL",
          "DUPLICATE",
          "DEVICE_REVOKED",
          "FORBIDDEN_FIELD",
          "RETRY_LATER"
        ]
      },
      {
        "step": "COMMIT",
        "method": "POST",
        "path": "/api/voice/device/commit",
        "body": [
          "client_capture_id",
          "sha256"
        ],
        "responses": [
          "ACCEPTED",
          "DUPLICATE",
          "DEVICE_REVOKED",
          "HASH_MISMATCH",
          "RETRY_LATER"
        ]
      }
    ],
    "upload": {
      "method": "PUT",
      "url": "upload_url z odpowiedzi UPLOAD_URL (podpisany adres Storage, ważny do upload_expires_at)",
      "contentTypes": {
        "IMA_ADPCM_WAV": "audio/wav",
        "OPUS": "audio/ogg"
      },
      "success": "HTTP 200 z Storage; urządzenie robi wtedy COMMIT"
    },
    "responseBody": {
      "always": [
        "code",
        "server_time"
      ],
      "UPLOAD_URL": [
        "upload_url",
        "upload_expires_at"
      ],
      "RETRY_LATER": [
        "retry_after_s"
      ]
    }
  },
  "clock": {
    "marker": "TIME_UNCERTAIN",
    "serverTime": "server_time w każdej odpowiedzi: UTC, ISO 8601 z milisekundami",
    "ageMs": "Czas od nagrania do wysłania INIT według licznika urządzenia, w milisekundach; 0 przy UNKNOWN",
    "states": [
      {
        "id": "SYNCED",
        "recordedAt": "recorded_at z urządzenia",
        "desc": "Zegar był ustawiony z server_time i urządzenie nie straciło od tego czasu zasilania."
      },
      {
        "id": "RELATIVE",
        "recordedAt": "chwila przyjęcia INIT minus age_ms",
        "desc": "Zegar nie był ustawiony, ale urządzenie nie straciło zasilania od nagrania, więc licznik jest ciągły."
      },
      {
        "id": "UNKNOWN",
        "recordedAt": "recorded_at z urządzenia, niewiarygodny",
        "desc": "Urządzenie straciło zasilanie między nagraniem a synchronizacją."
      }
    ],
    "uncertainStates": [
      "UNKNOWN"
    ],
    "when": "clock_state UNKNOWN albo wyliczony recorded_at w przyszłości względem server_time albo wcześniejszy niż ostatnia synchronizacja zegara urządzenia minus 24 godziny",
    "effect": "Kierownik zmiany przypisuje nagranie do zmiany ręcznie."
  },
  "authorship": {
    "source": "SELF_INTRODUCTION",
    "rule": "Przedstawienie w nagraniu z session_seq 1 ustala deklarowanego autora sesji. Ręczna korekta autora fragmentu ma pierwszeństwo przed deklaracją.",
    "sessionInactivityTimeoutMinutes": 180,
    "sessionStart": [
      "Opróżnienie urządzenia w stacji (wszystkie nagrania potwierdzone ACCEPTED albo DUPLICATE)",
      "Gest „Nowa osoba” na urządzeniu (przytrzymanie bocznego przycisku przez 3 s)",
      "Bezczynność urządzenia powyżej 3 godzin (sessionInactivityTimeoutMinutes) — automatyczne rozpoczęcie nowej sesji i ekran „Przedstaw się”"
    ],
    "outOfOrderPolicy": "RETROACTIVE_ON_SEQ_1",
    "outOfOrderRule": "Jeśli nagrania z session_seq > 1 dotrą przed session_seq 1 (np. po retry nieudanego PUT), pozostają tymczasowo jako NO_AUTHOR, a po dotarciu i transkrypcji session_seq 1 serwer retroaktywnie uzupełnia brakującą deklarację autora z zachowaniem ręcznych korekt.",
    "matchedBy": "server",
    "llmIdentifies": false,
    "matchOn": [
      "imię i nazwisko z transkryptu nagrania session_seq 1, porównane z personelem placówki urządzenia"
    ],
    "whenUnique": "Deklarowany autor sesji ustawiany automatycznie, zapis w audit_logs",
    "ambiguousResolvedBy": [
      "nurse:shift_lead",
      "org_admin:own"
    ],
    "whenMissing": "NO_AUTHOR — brak przedstawienia, brak dopasowania albo kilka osób; nagranie przyjęte, uprawniony kierownik rozstrzyga autorstwo fragmentów w kolejce",
    "deviceRegistry": "voice_device_assignments to opcjonalna ewidencja wydania sprzętu i nie wyznacza autora"
  },
  "responses": [
    {
      "code": "UPLOAD_URL",
      "http": 200,
      "deviceMayDelete": false,
      "desc": "Podpisany adres zapisu. Urządzenie wysyła plik i robi COMMIT."
    },
    {
      "code": "ACCEPTED",
      "http": 200,
      "deviceMayDelete": true,
      "desc": "Nagranie przyjęte po COMMIT."
    },
    {
      "code": "DUPLICATE",
      "http": 200,
      "deviceMayDelete": true,
      "desc": "To nagranie przyjęto już wcześniej."
    },
    {
      "code": "DEVICE_REVOKED",
      "http": 401,
      "deviceMayDelete": false,
      "desc": "Token nieznany albo unieważniony."
    },
    {
      "code": "FORBIDDEN_FIELD",
      "http": 422,
      "deviceMayDelete": false,
      "desc": "Żądanie zawiera pole z listy fields.forbidden."
    },
    {
      "code": "HASH_MISMATCH",
      "http": 422,
      "deviceMayDelete": false,
      "desc": "Skrót pliku w Storage nie zgadza się z INIT. Wysyłka do powtórzenia."
    },
    {
      "code": "RETRY_LATER",
      "http": 503,
      "deviceMayDelete": false,
      "desc": "Chwilowa niedostępność. Urządzenie ponawia przy kolejnym zrzucie."
    }
  ],
  "status": "STABLE"
} as const;

