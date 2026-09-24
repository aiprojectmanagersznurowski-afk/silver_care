# Work Order: INT-POLAR-ACCESSLINK

## Wymagania
Rejestr: INT-CORE-DECOUPLED, INT-INGEST-PRECONDITIONS, INT-NORMALIZATION, INT-SYNC-STALENESS

## Opis
Kompletna implementacja integracji opasek Polar (Polar 360, Polar Verity Sense) przez Polar AccessLink API v3:
1. Bezpieczne przechowanie tokena dostępowego per powiązanie `external_wearable_links` (tabela `polar_oauth_tokens`).
2. Klient Polar AccessLink (`apps/web/src/lib/polar-client.ts`) realizujący:
   - Wymianę kodu OAuth2 na token z nagłówkiem `Authorization: Basic base64(client_id:client_secret)` wg `OAUTH_CONFIG` (punkt krytyczny zdefiniowany w kontrakcie).
   - Rejestrację użytkownika w AccessLink API (`POST /v3/users`).
   - Pobieranie danych dobowych aktywności (`GET /v3/users/activities/{date}`) i snu (`GET /v3/users/sleep/{date}`).
   - Transformację pól zgodną z `FIELD_MAPPINGS`: kroki (`steps_total`), czas aktywności (`active_minutes` z ISO-8601 `PT...` na minuty), kalorie (`calories_total`), czas i godziny snu (`sleep_start_time`, `sleep_end_time`, `sleep_duration_min`).
   - Ochronę MDR Deny-by-default: surowe wykresy faz snu, częstość oddechów czy ciągłe tętno są bezwzględnie ignorowane i odrzucane.
3. Trasy API w Next.js:
   - `GET /api/polar/auth` — inicjowanie autoryzacji z przekierowaniem do Polar Flow.
   - `GET /api/polar/callback` — obsługa callbacku, wymiana na token, rejestracja usera i zapis powiązania w `external_wearable_links`.
   - `POST /api/polar/sync` — synchronizacja danych pensjonariusza i przekazanie znormalizowanego ładunku do `process_ingest_batch`.
   - `POST /api/polar/webhook` — obsługa webhooków/pingów z Polar AccessLink.
4. Komponent UI w panelu personelu/administratora:
   - Przycisk "Połącz opaskę Polar" i status połączenia w arkuszu edycji pensjonariusza (`ResidentEditSheet.tsx`).

## Kryteria akceptacji
- AC1: Wymiana kodu autoryzacyjnego na token używa nagłówka `Basic` wg `OAUTH_CONFIG`, a nie ciała żądania.
- AC2: Po udanej autoryzacji identyfikator użytkownika Polar trafia do `external_wearable_links`, a tabela `residents` pozostaje nienaruszona (brak `polar_user_id` w `residents`).
- AC3: Znormalizowane dane aktywności i snu są poprawnie zapisywane przez `process_ingest_batch` wyłącznie przy aktywnej zgodzie w `consent_ledger`.
- AC4: Próba pobrania lub zapisu pól zabronionych przez MDR (np. oddechy, hypnogram) jest blokowana (Deny by default).
