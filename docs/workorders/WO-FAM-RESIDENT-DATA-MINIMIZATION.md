# WO: FAM-RESIDENT-DATA-MINIMIZATION — Bliscy bez odczytu tabeli residents

## Wymaganie
Wymaganie kontraktowe: **`FAM-RESIDENT-DATA-MINIMIZATION`** (domain `family`, risk HIGH, source `SC-FAM-08`, story `[SC-FAM-08]` 📝 PROPOZYCJA). Decyzja Michała z 2026-11-16 (punkt 3 przy WO-ADM-RESIDENT-FUNDING).
Powiązane: `ORG-ISOLATION`, `MDR-NO-PHYSIO-TO-FAMILY`, `ADM-ARCHIVE`, `FAM-DASHBOARD`, `FAM-AGENDA`, `FAM-MESSAGES`.

## Ustalenie (lokalna baza, JWT rodziny, 2026-11-16)
`residents_family_select` daje rolom `family` i `legal_guardian` cały wiersz powiązanego podopiecznego. Przez API (`/rest/v1/residents?select=*`) bliski odczyta: `pesel_hash`, `is_zsn` (orzeczenie o niepełnosprawności, art. 9), `care_level`, `notes` (uwagi przyjęciowe personelu), `contract_monthly_rate`, `contract_source`, `contract_document_path` (ścieżka pliku umowy), `birth_date`, `gender`, `admission_date`.

Portal rodziny używa wyłącznie: `id`, `first_name`, `last_name`, `avatar_url`, `death_date`, `contract_end_date`, `archived_at` (+ `organization_id` w `api/messages`). Wąskie RPC `get_family_resident_overview()` (SECURITY DEFINER, z `20261030170000`) zwraca dokładnie te kolumny.

## Projekt
1. **Polityka:** usunąć `residents_family_select`. Rola bliskiego nie ma żadnej polityki `SELECT` na `residents`.
2. **Jedyna ścieżka odczytu:** `get_family_resident_overview()` (bez zmian kolumn).
3. **Plan dnia placówki:** `agenda_items_family_select` w gałęzi `resident_id IS NULL` łączy `residents` w kontekście bliskiego — po zdjęciu polityki zwróci pusto. Zastąpić podzapytanie funkcją `SECURITY DEFINER` `family_has_active_link_in_org()` (ta sama logika okna 30 dni co `is_relative_active_or_retained`).
4. **Kod portalu** przestaje czytać `residents` bezpośrednio:
   - `app/(family)/layout.tsx` (osadzenie `residents(...)` w `resident_relative_links`) → RPC;
   - `app/(family)/consents/page.tsx` (osadzenie) → RPC + `resident_relative_links` bez osadzenia;
   - `app/api/messages/route.ts` (`residents.organization_id`) → `organization_id` z JWT (RPC i tak filtruje po placówce z JWT) + sprawdzenie, że `resident_id` jest w wyniku RPC;
   - fallbacki w `dashboard`, `agenda`, `messages` (osadzenie `residents(...)` po błędzie RPC) → usunąć; błąd RPC to jawny błąd, nie cichy fallback.

## Kolejność (wspólna baza staging + produkcja)
| Krok | Zakres | Wdrożenie |
|---|---|---|
| **1** | Kod portalu bez odczytu `residents` (layout, consents, api/messages) + E2E rodziny | scalić i wdrożyć **przed** krokiem 3 |
| **2** | Fallbacki dashboard/agenda/messages → jawny błąd | razem z 1 albo po nim |
| **3** | Migracja: `family_has_active_link_in_org()`, nowa `agenda_items_family_select`, `DROP POLICY residents_family_select`; test `tests/db/family_resident_minimization.test.ts` (rodzina: 0 wierszy `residents`; RPC: tylko 7 kolumn; plan dnia placówki nadal widoczny) | zastosować **po** wdrożeniu kroków 1–2 |

RED kroku 1: lokalnie zastosowana migracja z kroku 3 → istniejące E2E rodziny (`family.spec`, zgody, wiadomości) czerwone; GREEN: kod przez RPC.

## Ryzyka
- Kolejność: migracja przed kodem psuje portal rodziny na produkcji (pusty nagłówek, brak zgód, błąd wysyłki wiadomości).
- `get_family_resident_overview` nie stosuje okna 30 dni — strony robią to same (widok po zgonie/wypisie, #164). Bez zmian w tym WO.
- Inne tabele osadzające `residents` w zapytaniach rodziny: sprawdzone `pg_policies` — tylko `agenda_items_family_select`.
