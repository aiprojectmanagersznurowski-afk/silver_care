# WO: ADM-RESIDENT-FUNDING — Źródło finansowania pobytu podopiecznego

## Wymaganie
Powiązane User Story: **`[SC-ADM-24]`** (📝 PROPOZYCJA).
Wymaganie kontraktowe: **`ADM-RESIDENT-FUNDING`** (risk HIGH, dodane w #212). Powiązane istniejące: `ADM-RESIDENT-CARD-VISIBILITY` (sekcja karty „Umowa i pakiety” tylko `org_admin`), `ORG-ISOLATION`, `SEC-NO-PII-LOGS`, `UI-TERMINOLOGY`.

## Kontekst
Decyzja Michała z 2026-11-16 (pamięć projektu: `contract-source-funding-decision`): `residents.contract_source` (Internet, Polecenie, Szpital, MOPS, Polecenie rodziny, Inne) to **kanał pozyskania**, a karta podopiecznego podpisuje je „Źródło finansowania” i przy braku danych pokazuje zmyślone `private` (`ResidentContractCard.tsx:24`, łamie zakaz fabrykowania w fallbackach). Finansowanie pobytu dostaje osobne pole z wartościami: Prywatnie (podopieczny lub rodzina), Gmina / MOPS, Współfinansowanie (prywatnie + gmina), Inne. Widzi i zmienia wyłącznie kierownik placówki.

### Ustalenia z kodu (2026-11-16)
- **W interfejsie nie ma edytora danych umowy.** `contract_source`, `contract_start_date`, `contract_monthly_rate` są tylko wyświetlane; zapisuje je wyłącznie import/seed. `contract_end_reason` zapisuje wypis (`resident-lifecycle.ts`).
- **Rodzina czyta cały wiersz `residents` swojego podopiecznego przez API.** `residents_family_select` nie ogranicza kolumn, a `authenticated` ma `SELECT` na wszystkich kolumnach. Sprawdzone na lokalnej bazie z JWT rodziny: dostępne `contract_monthly_rate`, `contract_source`, `notes`. Nowa kolumna w `residents` naruszyłaby AC3 wymagania — stąd osobna tabela (niżej). Problem istniejących kolumn jest poza zakresem tego WO (patrz „WYMAGA DECYZJI” 3).

## Projekt danych

| Tabela | Rola | Kolumny |
|---|---|---|
| `resident_funding` | źródło finansowania pobytu, tylko kierownik placówki | `resident_id` (PK, FK `residents` ON DELETE CASCADE), `organization_id` (FK), `funding_source` (`CHECK IN ('private','municipality','co_financed','other')`), `updated_by`, `updated_at` |

- Brak wiersza = „Brak danych”. Migracja **nie tworzy wierszy** dla istniejących podopiecznych (AC2, wymaganie: brak zgadywania).
- RLS: `SELECT`/`INSERT`/`UPDATE` wyłącznie `org_admin` z `organization_id = get_jwt_organization_id()` i `resident_id` należącym do tej placówki (`EXISTS` na `residents` — lekcja z #163). Brak polityk dla `nurse`, `family`, `legal_guardian`; `DELETE` niedostępny (zmiana na „brak” nie jest przewidziana w story). `REVOKE ALL FROM anon`.
- Zapis przez Server Action z `api-auth.ts` (rola z `app_metadata`), `upsert` po `resident_id`. Zmiana zapisuje `audit_logs` `RESIDENT_FUNDING_CHANGED` z `target_id` i kodami starej i nowej wartości, bez danych osobowych (story AC5).
- Kody i etykiety w `apps/web/src/lib/reporting-constants.ts` obok `CONTRACT_SOURCES` (`FUNDING_SOURCES`, `FUNDING_SOURCE_LABELS`). Lista wartości w kontrakcie jest opisowa (acceptance); jeśli recenzent woli stałą w `@silvercare/contracts`, to osobna zmiana kontraktu.

## Podział na kroki (każdy RED → GREEN, ≤3 pliki, osobny PR do `staging`)

| Krok | Zakres | Testy |
|---|---|---|
| **1** | Migracja `resident_funding` + RLS + typy (`database.types.ts`) | `tests/db/resident_funding_access.test.ts` (`@REQ: ADM-RESIDENT-FUNDING`): kierownik zapisuje i czyta; pielęgniarka, rodzina, opiekun prawny dostają 0 wierszy i odmowę zapisu; wartość spoza listy odrzucona; zapis dla podopiecznego innej placówki odrzucony |
| **2** | Karta „Umowa i pakiety”: etykieta „Źródło pozyskania”, „Brak danych” zamiast `private`, nowy wiersz „Źródło finansowania” (odczyt `resident_funding` tylko w ścieżce danych karty dla `org_admin`, `card-access.ts`) | E2E w `e2e/roles/resident-profile-layout.spec.ts` lub nowy spec: kierownik widzi obie etykiety i „Brak danych” dla podopiecznego bez wartości; karta pielęgniarki nie pobiera `resident_funding` (jak test `nurse-resident-card.spec.ts`) |
| **3** | Edycja źródła finansowania (miejsce wg decyzji 1) + Server Action z audytem | E2E: kierownik wybiera wartość, karta pokazuje etykietę; `tests/logic`: akcja odrzuca rolę inną niż `org_admin`, audyt bez PII |
| **4** *(opcjonalny, decyzja 2)* | Statystyki: rozkład źródeł finansowania obok źródeł pozyskania (RPC tylko `org_admin`, „Brak danych” jako osobna kategoria) | E2E statystyk |

Kolejność migracji: krok 1 scalony i zastosowany na wspólnej bazie **przed** krokiem 2 (kod czyta nową tabelę). Migrację stosuje człowiek po scaleniu.

## Granice i ryzyka
- **RODO:** finansowanie z gminy/MOPS ujawnia sytuację socjalną podopiecznego — dane wrażliwe biznesowo; tylko kierownik placówki, nie trafia do raportów dla bliskich, logów ani eksportów dla personelu.
- **Zakaz fabrykowania:** żadnej wartości domyślnej w bazie, akcji ani UI.
- **Terminologia:** „podopieczny”, „Kierownik placówki”, etykiety zdaniowo („Źródło finansowania”, „Źródło pozyskania”).
- **Standard ekranu:** wybór wartości przez komponenty szablonu (`Select`/`FilterSelect`), cel dotykowy 38px, bez koloru niosącego ocenę.

## Weryfikacja
Każdy krok: RED, GREEN, `node tools/sc-phase.mjs red|green`, `bash scripts/verify.sh --full`, dla UI testy E2E (Page Object, `@REQ: ADM-RESIDENT-FUNDING`), na końcu `pnpm test:db` i `pnpm test:e2e`.

## WYMAGA DECYZJI
1. **Gdzie kierownik wpisuje źródło finansowania?** Dziś nie ma żadnego edytora danych umowy. Propozycja: (a) edycja w sekcji karty „Umowa i pakiety” (przycisk „Zmień” przy polu) **oraz** (b) pole w kroku 1 kreatora przyjęcia (opcjonalne, puste = „Brak danych”). Wariant minimalny: tylko (a).
2. **Czy statystyki mają pokazywać rozkład źródeł finansowania** (krok 4), czy na razie tylko karta?
3. **Poza zakresem, do osobnego zadania (bezpieczeństwo):** rodzina odczytuje przez API pełny wiersz `residents` swojego podopiecznego, w tym `contract_monthly_rate`, `contract_source`, `notes` (uwagi przyjęciowe personelu). Czy zakładamy kartę `SEC`/`ORG-ISOLATION` na ograniczenie kolumn dla ról bliskich (np. widok lub RPC jak `get_family_resident_overview`)?
