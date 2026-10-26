# WO: UI-RESIDENT-CARD — Wspólna karta podopiecznego dla personelu (widoczność sekcji według roli)

## Wymaganie
Powiązane User Story: **`[SC-ADM-20]`** (📝 PROPOZYCJA)
Powiązane wymagania kontraktowe: istniejące `ORG-ISOLATION`, `SEC-PESEL-HASH`, `MDR-NO-INTERPRETATION`, `UI-ACCESSIBILITY`, `UI-TEMPLATE-ALIGNMENT`; **proponowany nowy:** `ADM-RESIDENT-CARD-VISIBILITY` (zmiana `contracts/`, okno kontraktowe otwiera człowiek).

## Kontekst i problem (ustalenia z audytu 2026-10-25)
1. Profil podopiecznego istnieje tylko dla kierownika: `/admin/residents/[id]` w powłoce `(admin)`. Personel opiekuńczy (`nurse`) nie ma dostępu do tej części aplikacji, więc wyniki wyszukiwarki i linki dla niego kończą się ślepą uliczką.
2. Strona pobiera całe wiersze (`select('*')`) wraz z relacjami (powiązania bliskich, zdarzenia, pakiety z `monthly_rate`) i przekazuje je do komponentów klienckich (`'use client'`). Do przeglądarki trafia więc m.in. `pesel_hash`, a każda rola, która dostałaby tę stronę, dostałaby też dane, których kontrakt jej nie przyznaje.
3. Macierz uprawnień (`roles.contract.mjs`) przyznaje personelowi opiekuńczemu odczyt `residents`, `rooms`, `beds`, `bed_assignments`, `wellness_daily`, `daily_reports` (własne), `daily_agenda` (własne), ale **nie** `resident_relative_links`, `consent_ledger` ani `external_wearable_links`. Tabele `resident_events` i `resident_packages` nie są w kontrakcie wcale.
4. Kontrakt nie opisuje, co składa się na kartę, więc dziś nic nie pilnuje zgodności widoku z macierzą.

## Rozwiązanie
1. **Kontrakt** (`presentation.contract.mjs`): eksport `RESIDENT_CARD_SECTIONS` — lista `{ id, label, roles, resources }`. Reguła w `sc-validate`: każda rola sekcji musi mieć odczyt **każdego** zasobu sekcji w `MATRIX`. Nowe `@REQ: ADM-RESIDENT-CARD-VISIBILITY` z kryteriami z `SC-ADM-20`. Wygenerowane `presentation.ts` importuje aplikacja.
2. **Warstwa danych** `getResidentCard(supabase, residentId, role)`: wybiera kolumny i relacje wyłącznie dla sekcji roli (jawna lista, nigdy `*`, bez `pesel_hash`), zwraca typ zawężony do roli. Odmowa dla roli spoza personelu przed zapytaniem.
3. **Wspólne komponenty** `components/residents/card/*`: szkielet karty (nagłówek, zakładki) i sekcje renderowane według listy z kontraktu; komponenty sekcji serwerowe tam, gdzie nie potrzebują interakcji.
4. **Dwie cienkie trasy** (każda ≤40 linii): `/admin/residents/[id]` (przebudowa istniejącej) i `/staff/residents/[id]` (nowa). Każda w swojej powłoce, obie wołają ten sam komponent z rolą.
5. **Linki według roli:** funkcja `residentHref(role, id)` używana przez wyszukiwarkę, tablicę dyżuru i listy.

## Plan etapów (osobne PR-y, każdy RED → GREEN, ≤3 pliki na commit)
| Etap | Zakres | Ryzyko i wycofanie |
|---|---|---|
| 3.0 | Poprawka #119: nurse bez odczytu `resident_relative_links` (zgodnie z kontraktem) | Małe. Wycofanie: polityka z poprzedniej wersji |
| 3.1 | Kontrakt: `RESIDENT_CARD_SECTIONS`, nowe REQ, reguła walidatora, codegen (**okno kontraktowe**) | Średnie. Wycofanie: revert commitów kontraktu |
| 3.2 | Warstwa danych `getResidentCard` + testy `tests/logic` i `tests/db` (jawne kolumny, brak `pesel_hash`, odmowa ról) | Małe. Moduł nieużywany do 3.3 |
| 3.3 | Przebudowa trasy kierownika na wspólne komponenty; E2E regresji kierownika | **Największe**: dotyka działającego ekranu. Wycofanie: revert PR |
| 3.4 | Trasa `/staff/residents/[id]` dla personelu + E2E (Page Object): widzi dozwolone sekcje, nie widzi pozostałych, rodzina odrzucona | Średnie. Nowa trasa, można wyłączyć usunięciem linków |
| 3.5 | Linki według roli (wyszukiwarka, tablica dyżuru, lista) + E2E | Małe |
| 3.6 | Linki do pokoju, łóżka, planu dnia i raportu (parametry na istniejących stronach, np. `?room=`, `?resident=`) | Małe, osobny PR |

Szybka poprawka niezależna od karty (proponuję zrobić od razu): w obecnym profilu kierownika ograniczyć `select('*')` do jawnej listy kolumn bez `pesel_hash`.

## Weryfikacja
- Testy logiczne: `getResidentCard` i `RESIDENT_CARD_SECTIONS` (wykonują realny kod), w tym przypadki: `family`, `legal_guardian`, brak roli, `user_metadata` bez `app_metadata`.
- Testy bazy: pielęgniarka nie czyta powiązań bliskich ani zgód; izolacja placówek bez zmian.
- E2E Playwright: kierownik widzi wszystkie sekcje, pielęgniarka tylko swoje; rodzina i opiekun prawny nie otwierają obu tras; klawiatura i powrót fokusu; pełna bramka `bash scripts/verify.sh --full`.

## Decyzje (Michał, 2026-10-25)
1. **Bliscy i kontakty:** personel opiekuńczy **nie** widzi tej sekcji (zgodnie z kontraktem: odczyt `resident_relative_links` tylko kierownik i opiekun prawny). Bez zmiany kontraktu.
2. **Metryki:** w karcie wyłącznie metryki behawioralne (kroki, czas aktywności, długość i godziny snu) jako fakty, bez wykresów trendu. Fizjologiczne nie są prezentowane.
3. **Zdarzenia pobytu i pakiety:** wyłącznie kierownik, do czasu dopisania `resident_events` i `resident_packages` do kontraktu.
4. **Trasa personelu:** `/staff/residents/[id]`.
5. **Poprawka #119 (etap 3.0):** zatwierdzona — odczyt powiązań bliskich zawężony do kierownika i superadmina.
