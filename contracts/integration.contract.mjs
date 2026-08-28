/**
 * integration.contract.mjs — warstwa pośrednia między źródłami zewnętrznymi a rdzeniem.
 *
 * ADR-002: `care_homes` z dokumentu Polar i `organizations` ze schematu
 * produkcyjnego to ten sam byt pod dwiema nazwami. Rdzeń nazywa się
 * `organizations` i `residents`. Identyfikatory zewnętrzne NIE mieszkają na
 * rekordzie rdzenia — żyją w tabelach mapujących.
 *
 * Powód: jeden pensjonariusz może mieć jutro drugie urządzenie innego producenta,
 * a placówka może mieć własny identyfikator w systemie sieci. Gdyby `polar_user_id`
 * siedział na `residents`, każdy nowy dostawca oznaczałby migrację rdzenia.
 */

export const PROVIDERS = [
  { id: 'POLAR', kind: 'WEARABLE', status: 'ACTIVE',  region: 'EU_FINLAND', auth: 'OAUTH2', desc: 'Polar 360 przez AccessLink API. Dostawca referencyjny MVP.' },
  { id: 'GARMIN', kind: 'WEARABLE', status: 'PLANNED', region: 'UNKNOWN',  auth: 'OAUTH2', desc: 'Rozważany wariant zapasowy. Wymaga weryfikacji lokalizacji przetwarzania przed włączeniem.' },
  { id: 'TERRA',  kind: 'AGGREGATOR', status: 'PLANNED', region: 'UNKNOWN', auth: 'API_KEY', desc: 'Agregator wielu producentów. Uniezależnia od jednego dostawcy.' },

  /**
   * GROQ — transkrypcja audio (ADR-009, rozstrzygnięte 2026-08-27).
   *
   * Jedyny dostawca w systemie z UDOKUMENTOWANYM WYJĄTKIEM od reguły „dane nie
   * opuszczają EOG". Infrastruktura Groq jest podstawowo w USA — transfer surowego
   * audio odbywa się na bazie standardowych klauzul umownych (SCC), nie fizycznej
   * rezydencji w Europejskim Obszarze Gospodarczym.
   *
   * Wyjątek jest ograniczony do etapu TRANSCRIBE w potoku głosowym (surowe audio,
   * PRZED klasyfikacją strumieni i redakcją z ADR-007). Transkrypt tekstowy, po
   * usunięciu danych medycznych, trafia do modelu generującego raport wyłącznie
   * w infrastrukturze europejskiej. Wyjątek dotyczy więc jednego, izolowanego
   * etapu — nie całego potoku.
   */
  {
    id: 'GROQ', kind: 'TRANSCRIPTION', status: 'ACTIVE', region: 'US', auth: 'API_KEY',
    transferMechanism: 'SCC',
    exceptionApprovedBy: 'Michal, 2026-08-27',
    exceptionReason: 'Darmowy poziom (2000 żądań/dzień, 8h audio/dzień) eliminuje koszt transkrypcji w MVP dla piętnastu do dwudziestu pięciu pensjonariuszy. Umowa powierzenia istnieje, zerowa retencja dostępna do ręcznego włączenia. Wyjątek ograniczony do surowego audio przed redakcją — transkrypt zredagowany i wygenerowany raport zostają w infrastrukturze UE.',
    requiresManualZeroRetentionToggle: true,
    desc: 'Whisper Large v3 Turbo przez GroqCloud. Transkrypcja surowego audio na etapie TRANSCRIBE, zanim transkrypt trafi do klasyfikatora strumieni.',
  },
];

/** Mapowanie pensjonariusza na konto u dostawcy. Jeden rdzeń, wiele powiązań. */
export const WEARABLE_LINK = {
  table: 'external_wearable_links',
  coreKey: 'resident_id',
  externalKeys: ['provider', 'external_user_id', 'external_device_id'],
  uniqueness: 'Jedno AKTYWNE powiązanie na parę (resident_id, provider). Historia zachowana przez unlinked_at.',
  desc: 'Warstwa pośrednia: rdzeń nie wie, że istnieje Polar.',
};

/** Mapowanie placówki na identyfikator w systemie zewnętrznym. */
export const ORG_LINK = {
  table: 'external_org_links',
  coreKey: 'organization_id',
  externalKeys: ['provider', 'external_org_id'],
  uniqueness: 'Jedno aktywne powiązanie na parę (organization_id, provider).',
  desc: 'Obsługuje sieci placówek i systemy źródłowe używające własnego nazewnictwa (np. care_home).',
};

/**
 * Normalizacja: surowe pola dostawcy → kanoniczne pola `wellness_daily`.
 * `familyVisible` odsyła do presentation.contract — tam jest granica MDR (ADR-005).
 */
export const FIELD_MAPPINGS = [
  { canonical: 'steps_total',            provider: 'POLAR', from: 'activity.active_steps',                     kind: 'BEHAVIORAL',   familyVisible: true },
  { canonical: 'active_minutes',         provider: 'POLAR', from: 'activity.duration (ISO 8601 → minuty)',     kind: 'BEHAVIORAL',   familyVisible: true },
  { canonical: 'calories_total',         provider: 'POLAR', from: 'activity.calories',                          kind: 'BEHAVIORAL',   familyVisible: false },
  { canonical: 'sleep_duration_min',     provider: 'POLAR', from: 'sleep.sleep_end_time − sleep_start_time',    kind: 'BEHAVIORAL',   familyVisible: true },
  { canonical: 'sleep_start_time',       provider: 'POLAR', from: 'sleep.sleep_start_time',                     kind: 'BEHAVIORAL',   familyVisible: true },
  { canonical: 'sleep_end_time',         provider: 'POLAR', from: 'sleep.sleep_end_time',                       kind: 'BEHAVIORAL',   familyVisible: true },
  { canonical: 'sleep_score',            provider: 'POLAR', from: 'sleep.sleep_score',                          kind: 'PHYSIOLOGICAL', familyVisible: false },
  { canonical: 'hrv_ms',                 provider: 'POLAR', from: 'nightly_recharge.heart_rate_variability_ms', kind: 'PHYSIOLOGICAL', familyVisible: false },
  { canonical: 'resting_heart_rate_bpm', provider: 'POLAR', from: 'nightly_recharge.heart_rate_bpm',            kind: 'PHYSIOLOGICAL', familyVisible: false },
  { canonical: 'breathing_rate',         provider: 'POLAR', from: 'nightly_recharge.breathing_rate',            kind: 'PHYSIOLOGICAL', familyVisible: false },
];

/** Warunki, bez których ingest nie ma prawa zapisać ani jednego wiersza. */
export const INGEST_PRECONDITIONS = [
  { id: 'active_consent',   desc: 'Aktywna zgoda na cel wellness_data_ingest w consent_ledger.', onFail: 'REJECT_AND_LOG' },
  { id: 'resident_active',  desc: 'Pensjonariusz nie jest zarchiwizowany ani usunięty (SC-ADM-05/AC3).', onFail: 'REJECT_AND_LOG' },
  { id: 'link_active',      desc: 'Istnieje aktywne powiązanie w external_wearable_links.', onFail: 'REJECT_AND_LOG' },
  { id: 'idempotency',      desc: 'Ta sama paczka danych nie może utworzyć drugiego wiersza — klucz (resident_id, provider, date, metric).', onFail: 'UPSERT' },
];

/** Próg uznania urządzenia za odłączone (SC-FAM-03/AC3). Opisowy, nie alarmowy. */
export const SYNC_STALENESS = { thresholdHours: 6, message: 'Urządzenie obecnie poza zasięgiem huba', kind: 'INFORMATIONAL', status: 'STABLE' };

export const OAUTH_CONFIG = {
  provider: 'POLAR',
  tokenEndpoint: 'https://polarremote.com/v2/oauth2/token',
  scope: 'accesslink.read_all',
  authHeader: 'Basic base64(client_id:client_secret)',
  note: 'Wymiana kodu na token wymaga nagłówka Authorization z zakodowanymi danymi klienta, a nie parametrów w ciele żądania. To był punkt, na którym zatrzymał się wcześniejszy proof of concept.',
};
