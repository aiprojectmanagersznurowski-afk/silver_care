# WO: VOICE-DEVICE-INGEST — Kanał urządzeń Zero-UI: przyjęcie nagrań, rejestr urządzeń, kolejka przypisania

## Wymaganie
Powiązane User Story: **`[SC-NUR-17]`**, **`[SC-NUR-18]`**, **`[SC-ADM-24]`** (📝 PROPOZYCJA). ADR-022 (📝, czeka na potwierdzenie Darka).
Wymagania kontraktowe (dodane w oknie kontraktowym 2026-11-17, commit `804f929`): `VOICE-DEVICE-INGEST`, `VOICE-RESIDENT-ASSIGN`, `VOICE-DEVICE-REGISTRY`, doprecyzowane `VOICE-ZERO-GUESSING`. Wdraża też: `VOICE-RETENTION`, `VOICE-DRAFT-ISOLATION`, `ORG-ISOLATION`.
Kontrakt: `CAPTURE_SOURCES`, `RESIDENT_ASSIGNMENT` (`voice.contract.mjs`), `DEVICE_AUTH`, `DEVICE_INGEST_PROTOCOL` (`integration.contract.mjs`), zasoby `voice_devices`, `voice_device_assignments`, `voice_assignment_queue` (`roles.contract.mjs`). Reguły bramki R08, R31, R33, R34.

## Kontekst
Decyzje Michała z 2026-11-16 i 2026-11-17 (ADR-022): urządzenie M5Stack StickS3; nagranie z urządzenia bez `resident_id`, serwer podsuwa kandydatów, kierownik zmiany albo kierownik placówki potwierdza; endpoint w Next.js z podpisanym adresem zapisu w Storage; przydział urządzenia ręcznie przy wydaniu; rozszerzenie `voice_draft_notes`; kolejka jako osobny zasób, brudnopis prywatny dla autora. Firmware powstaje w repozytorium `silver-care-devices` i przypina `packages/contracts/src/generated/device-protocol.json`.

## Stan wyjściowy (sprawdzony 2026-11-17)
- `voice_draft_notes`: `resident_id NOT NULL`, `nurse_id NOT NULL`, idempotencja aplikacji przez `client_uuid UNIQUE`. RLS: autor czyta swoje, kierownik placówki nie czyta (test `tests/db/voice.test.ts:259-269`).
- **Audio z aplikacji nie jest dziś przechowywane w Storage** (`audio_url` = `'local-pending-storage'` w `api/voice/submit/route.ts`). Nie ma bucketu na nagrania. Istnieją tylko `avatars` i `resident_media`.
- `is_shift_lead(shift_definition_id, shift_date)` istnieje (migracja `20261030100000`) i nadaje się do RLS kolejki.

## Projekt danych

| Obiekt | Rola | Kluczowe kolumny i ograniczenia |
|---|---|---|
| `voice_devices` | rejestr urządzeń placówki | `organization_id`, `label` („Stick 04”, unikalny w placówce), `token_hash` (SHA-256 z 32 losowych bajtów, unikalny), `revoked_at`, `last_sync_at`, `firmware_version`, `created_by` |
| `voice_device_assignments` | stałe przypisanie do pracownika, zamykane zwrotem | `organization_id`, `device_id`, `user_id`, `started_at`, `ended_at`, `assigned_by`; **bez nakładania się przedziałów na jednym urządzeniu** (`EXCLUDE USING gist`, wymaga `btree_gist`) |
| `voice_draft_notes` (rozszerzenie) | jeden model nagrania | `source` (`APP`/`DEVICE`, domyślnie `APP`), `device_id`, `client_capture_id`, `recorded_at`, `time_uncertain`, `audio_sha256`; `resident_id` i `nurse_id` NULL tylko dla `DEVICE` (`CHECK`); unikalne `(device_id, client_capture_id)` |
| `voice_assignment_queue` | pozycje czekające na decyzję | `organization_id`, `note_id`, `shift_definition_id`, `shift_date`, `candidates` (tylko identyfikatory i powód dopasowania, bez imion), `status` (`PENDING`/`DECIDED`), `outcome` (`RESIDENT`/`FACILITY`/`UNASSIGNABLE`), `resident_id`, `decided_by`, `decided_at` |
| bucket `voice-recordings` | pliki nagrań z obu kanałów | prywatny, bez polityk dla klienta, region UE, ścieżka `{organization_id}/{source}/{id}` |
| retencja placówki | `VOICE_RETENTION` per placówka | kolumna na `organizations` albo osobna tabela ustawień; 7–90 dni, domyślnie 30; zmienia `org_admin` swojej placówki i `super_admin`; zmiana w `audit_logs` |

- RLS kolejki: odczyt i decyzja dla `org_admin` swojej placówki oraz `nurse` tylko gdy `is_shift_lead` dla zmiany pozycji. Bliscy: zero wierszy. Po decyzji pozycja przestaje być widoczna (`status = 'DECIDED'`).
- Decyzja w kolejce to RPC (SECURITY DEFINER, `auth.uid()` z JWT): zapisuje decyzję, ustawia `resident_id` na notatce, pisze `audit_logs` (kandydaci i wybór, bez treści nagrania) i dopiero wtedy przekazuje notatkę do istniejącego potoku.

## Endpoint `/api/voice/device`

- Urządzenie nie ma sesji, więc trasa działa po stronie serwera kluczem `service_role`. **Każde zapytanie filtruje po `organization_id` z rekordu urządzenia, nigdy z żądania.** Klucz nie opuszcza serwera.
- `INIT`: token z `X-Device-Token` → skrót → urządzenie aktywne; odrzuć pola z `fields.forbidden` (`FORBIDDEN_FIELD`); para `(device_id, client_capture_id)` już przyjęta → `DUPLICATE`; inaczej `createSignedUploadUrl` → `UPLOAD_URL`.
- `COMMIT`: sprawdź obiekt w Storage i skrót → `voice_draft_notes` (`DEVICE`), autor z przydziału w chwili `recorded_at` (brak → `nurse_id` NULL, oznaczenie „brak autora”), `time_uncertain` według `DEVICE_INGEST_PROTOCOL.clock`, pozycja w kolejce → `ACCEPTED`.
- Logi: tylko `device_id`, `organization_id`, kod odpowiedzi. Bez tokenu, nazw plików z treścią i transkryptu.

## Podział na kroki (każdy RED → GREEN, ≤3 pliki na commit)

| Krok | Zakres | Test RED |
|---|---|---|
| **1** | ✅ Kontrakt i reguły bramki (commity `e794ba5`, `804f929`) | selftest 64/64 |
| **2** | Migracja: `voice_devices`, `voice_device_assignments`, RLS | `tests/db`: bliscy odrzuceni, brak nakładania przydziałów, kierownik zmiany przydziela tylko na swojej zmianie, brak `DELETE` |
| **3** | Migracja: rozszerzenie `voice_draft_notes`, `voice_assignment_queue`, bucket `voice-recordings`, RLS | `tests/db`: `APP` bez `resident_id` odrzucone, duplikat `(device_id, client_capture_id)` odrzucony, kierownik placówki nadal nie czyta `voice_draft_notes`, kolejka czytelna tylko dla kierowników |
| **4** | Biblioteka `device-auth.ts` (skrót, weryfikacja tokenu) i `device-ingest.ts` (logika INIT/COMMIT) | `tests/logic`: każdy kod z `DEVICE_INGEST_PROTOCOL.responses`, `deviceMayDelete` tylko dla `ACCEPTED`/`DUPLICATE` |
| **5** | Trasa `/api/voice/device` | `tests/logic`: unieważniony token → 401, `resident_id` w żądaniu → 422 |
| **5a** | Aplikacja zapisuje audio w `voice-recordings` (zamiast `'local-pending-storage'`) | `tests/logic`: notatka z aplikacji ma `audio_url` w buckecie |
| **6** | Retencja per placówka: ustawienie 7–90 dni (domyślnie 30), cron usuwa plik i wiersz po terminie placówki | `tests/db`: plik i wiersz znikają po terminie, wartość spoza zakresu odrzucona, bliscy i `nurse` nie zmieniają retencji |
| **7** | `/admin`: rejestr urządzeń, token pokazany raz, unieważnienie, przydział przy wydaniu (`SC-ADM-24`) | E2E (Page Object, `@REQ: VOICE-DEVICE-REGISTRY`) |
| **8** | Kolejka „Do przypisania”: transkrypcja, dopasowanie serwera, decyzja, przekazanie do potoku (`SC-NUR-18`) | E2E i `tests/logic` (`@REQ: VOICE-RESIDENT-ASSIGN`) |
| **9** | `silver-care-devices`: reguły repo, makieta serwera z `device-protocol.json`, firmware | osobne repozytorium |

Kroki 2–6 dają działające przyjęcie nagrań bez UI: da się je sprawdzić skryptem udającym urządzenie, zanim powstanie firmware.

## Granice i ryzyka

- **ADR-006 / MDR:** model nie wskazuje podopiecznego. Dopasowanie jest deterministyczne (nazwisko, `rooms.number`, `beds.label`) i wyłącznie w placówce urządzenia. Bez decyzji człowieka brak `CLASSIFY` (R08).
- **RODO art. 9:** pliki w prywatnym buckecie w UE. Transkrypcja nagrań bez przypisania idzie przez Groq jak dziś (ADR-009, surowe audio przed maskowaniem). Kandydaci w kolejce przechowywani jako identyfikatory, imiona dociągane przy wyświetleniu.
- **`service_role` w trasie urządzeń:** największe ryzyko kroku 5. Wymaga recenzji pod kątem filtra `organization_id` w każdym zapytaniu.
- **Zegar StickS3:** brak potwierdzonego układu RTC (kompendium §1). `TIME_UNCERTAIN` musi działać od pierwszego dnia.

## Weryfikacja
Każdy krok: test RED, GREEN, `node tools/sc-phase.mjs`, `bash scripts/verify.sh --full`, a dla UI testy E2E (Page Object, `@REQ`). Migracje stosowane po scaleniu, wspólna baza dla stagingu i produkcji.

## Rozstrzygnięte (Michał, 2026-11-17)
1. **Przydział:** urządzenie przypisane pracownikowi na stałe, przydział zamyka wyłącznie zwrot.
2. **Audio z aplikacji:** zapisywane w `voice-recordings`, jak z urządzeń.
3. **Retencja:** konfigurowalna per placówka przez kierownika placówki i super admina, 7–90 dni, domyślnie 30. **Wymaga okna kontraktowego** (`VOICE_RETENTION`, `VOICE-RETENTION`) przed krokiem 6.

## WYMAGA DECYZJI
1. **Format nagrań na urządzeniu** (repo `silver-care-devices`): rekomendacja Opus 16 kb/s w Ogg, ok. 34 min z aktualizacjami przez Wi-Fi wobec ok. 8 min dla IMA ADPCM. Do potwierdzenia pomiarem na egzemplarzu.
