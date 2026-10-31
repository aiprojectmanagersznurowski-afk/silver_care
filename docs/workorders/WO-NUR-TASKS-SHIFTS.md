# WO: NUR-TASKS-SHIFTS — Zmiany, grafik, kierownik zmiany i moduł zadań

## Wymaganie
Powiązane User Story: **`[SC-NUR-12]`** (AC1, AC1a), **`[SC-NUR-13]`**, **`[SC-NUR-15]`**, **`[SC-NUR-16]`**, **`[SC-ADM-21]`**, **`[SC-ADM-23]`** (wszystkie 📝 PROPOZYCJA). ADR-021 wraz z uzupełnieniem z 2026-10-30.
Powiązane wymagania kontraktowe: istniejące `ORG-ISOLATION`, `SEC-SESSION`, `MDR-NO-INTERPRETATION`, `UI-TERMINOLOGY`, `UI-TEMPLATE-ALIGNMENT`. **Proponowane nowe** (zmiana `contracts/`, okno kontraktowe otwiera człowiek): `NUR-SHIFT-CONFIG`, `NUR-SHIFT-LEAD`, `NUR-TASKS`, `NUR-SHIFT-PLAN-PRINT`, `ADM-CARE-PLAN-TASKS`, a w kolejnych etapach `NUR-TASKS-AI-PROPOSAL`, `NUR-TASKS-VOICE-COMPLETION`.

## Kontekst
Decyzje Michała z 2026-10-30 (pamięć projektu: `tasks-module-decisions`): najpierw konfiguracja zmian; kierownik zmiany to osoba z personelu opiekuńczego wyznaczona w grafiku (wariant B); opiekunki pracują na **wydruku**, a obsługę systemu przejmuje kierownik zmiany; rozliczenie zmiany z notatek głosowych potwierdza człowiek; zadania wykonane / anulowane z powodem / przeniesione; źródło zadania zawsze widoczne; lista grupowana per pokój albo per podopieczny; zadania standardowe jako wydzielony komponent „plan opieki”.

## Projekt danych

Zmiana nie jest wiersz-instancją tworzoną z wyprzedzeniem. **Zmiana to klucz `(shift_definition_id, shift_date)`** — prostsze niż `facility_shifts` z projektu v2.0 i bez zadania, które tworzy dobowe wiersze w tle.

| Tabela | Rola | Kluczowe kolumny |
|---|---|---|
| `shift_definitions` | definicje zmian placówki (2 lub 3 na dobę) | `organization_id`, `code`, `name`, `start_time`, `end_time`, `crosses_midnight`, `order_index`, `is_active`; strefa zawsze `Europe/Warsaw` |
| `shift_roster` | grafik: kto pracuje na zmianie i kto ją prowadzi | `organization_id`, `shift_definition_id`, `shift_date`, `user_id`, `is_shift_lead`; **jeden kierownik zmiany na `(definicja, data)`** (częściowy unikalny indeks) |
| `shift_tasks` | zadania | `organization_id`, `shift_definition_id`, `shift_date`, `resident_id` (NULL = placówka), `assignee_user_id` (NULL = cała zmiana), `title`, `due_time`, `source` (`MANUAL`/`HANDOVER`/`CARE_PLAN`), `source_ref` (szablon albo odcinek przekazania), `source_quote`, `carried_from_task_id`, `status` (`PROPOSED`/`TODO`/`DONE`/`CANCELLED`), `cancel_reason`, `settled_by`, `settled_at`, `plan_version` |
| `shift_plan_approvals` | akceptacje planu zmiany (wersje wydruku) | `organization_id`, `shift_definition_id`, `shift_date`, `version`, `approved_by`, `approved_at`, `printed_at` |

- Wszystkie tabele tylko dla personelu: **RLS odmawia `family` i `legal_guardian`**, osobne od `agenda_items`. Złożone klucze `(id, organization_id)` jak w projekcie v2.0.
- `cancel_reason` obowiązkowy przy `CANCELLED` (ograniczenie `CHECK`). Zmiany statusu zapisują `audit_logs` (bez treści zadania).
- Przeniesienie na kolejną zmianę tworzy **nowe zadanie** z `carried_from_task_id`, a stare zostaje `TODO` z `settled_*` pustym do czasu zamknięcia zmiany. Dzięki temu historia nie ginie.

## Uprawnienia: kierownik zmiany (decyzja B)

Obecna macierz zna role i zakres `:own` placówki, ale nie zna „roli na zmianie”. Propozycja:
- Nowy zakres w `MATRIX`: **`nurse:shift_lead`**, czyli rola `nurse` wyłącznie wtedy, gdy zalogowany jest `is_shift_lead` w grafiku **dla tej zmiany**. Walidator (R12) zna `:own`; trzeba dopisać zakres i regułę, że `shift_lead` dotyczy tylko zasobów z kluczem zmiany (`shift_tasks`, `shift_plan_approvals`).
- Funkcja bazodanowa `is_shift_lead(p_org uuid, p_shift_definition_id uuid, p_shift_date date)` (SECURITY DEFINER, `auth.uid()` z JWT, nie z parametru) używana w politykach RLS i w RPC. Rola nadal wyłącznie z `app_metadata`.
- Macierz (docelowa):
  - `shift_definitions`: `org_admin` pełny, `nurse` odczyt;
  - `shift_roster`: `org_admin` pełny, `nurse` odczyt własnej placówki;
  - `shift_tasks`: odczyt `nurse:own`; tworzenie zadań ręcznych `nurse:own` (status `PROPOSED`); zmiana statusu, akceptacja i rozliczenie `nurse:shift_lead` i `org_admin`;
  - `shift_plan_approvals`: tworzenie `nurse:shift_lead` i `org_admin`.

## Podział na Work Ordery (każdy RED → GREEN, ≤3 pliki na commit)

| Krok | Zakres | Okno kontraktowe |
|---|---|---|
| **1** | Kontrakt: zasoby, zakres `shift_lead`, REQ, sekcja karty „Zadania”, reguła walidatora i mutacje w selftest | **tak** |
| **2** | Migracja: `shift_definitions`, `shift_roster`, funkcja `is_shift_lead`, RLS; test `tests/db` (izolacja placówek, rodzina odrzucona, jeden kierownik na zmianę) | nie |
| **3** | Ekran konfiguracji zmian i grafiku dla kierownika placówki (`/admin/facility/shifts`) + E2E | nie |
| **4** | Migracja zadań i planów, RLS i RPC rozliczenia; test bazy (kierownik zmiany tylko na swojej zmianie, anulowanie bez powodu odrzucone) | nie |
| **5** | Lista zadań zmiany: dodawanie ręczne, grupowanie per pokój / per podopieczny, źródło widoczne, akceptacja planu, rozliczenie z trzema ścieżkami + E2E | nie |
| **6** | Wydruk planu pracy (`/staff/shift-plan/print`, A4, ślad w audycie) + E2E | nie |
| **7** | Sekcja „Zadania” na karcie podopiecznego i znacznik „wymaga uwagi” z otwartych zadań | nie |
| **8** | Plan opieki: szablony zadań standardowych per profil opieki, generowanie planu zmiany | nie |
| **9** | Propozycje AI z przekazania (`HANDOVER_STRUCTURE`, `TASK_PROPOSE`) | częściowo (etapy potoku) |
| **10** | Rozliczenie z notatek głosowych („wykonane?” z cytatem) | nie |

Kroki 2–8 działają bez AI i dają użyteczny moduł; AI dochodzi dopiero w krokach 9–10.

## Granice i ryzyka

- **MDR:** zadania to polecenia personelu i plan ustalony przez placówkę; system nie podpowiada czynności opiekuńczych ze stanu zdrowia. Zalecenia lekarza i harmonogram leków (`SC-ADM-23/AC6`) tylko po osobnym ADR.
- **RODO art. 9:** wydruk zawiera imię, nazwisko, pokój i treść zadania — bez PESEL i kontaktów; każdy wydruk w audycie; w logach serwera brak treści zadań.
- **Terminologia:** „podopieczny”, „placówka”, „Kierownik placówki” (rola `org_admin`) i „kierownik zmiany” (rola na zmianie), zgodnie z `UI_TERMINOLOGY`.
- **Standard ekranu:** tabela jako widok domyślny, `PageHeader`, `StatusBadge`, `TableCard`, stronicowanie po 50 przy długich listach, bez koloru niosącego ocenę.

## Weryfikacja
Każdy krok: test RED, GREEN, `node tools/sc-phase.mjs`, `bash scripts/verify.sh --full`, a dla UI testy E2E (Page Object, `@REQ`). Migracje stosowane po scaleniu kodu, który ich nie wymaga do działania.

## Decyzje do potwierdzenia
1. Czy zmiana jako klucz `(definicja, data)` (bez wierszy instancji) Darkowi pasuje, czy woli instancje `facility_shifts` z projektu v2.0?
2. Zakres uprawnień `nurse:shift_lead` w kontrakcie i funkcja `is_shift_lead` w bazie, czy inny sposób?
