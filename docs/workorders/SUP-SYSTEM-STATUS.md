# WO: SUP-SYSTEM-STATUS — Globalne alerty systemowe i status platformy (Wariant A)

## Wymaganie
Powiązane User Story: **`[SC-SUP-05]`**
Powiązane wymagania kontraktowe: brak nowego `@REQ` (wdraża reguły: `@REQ: SEC-AUDIT-APPEND-ONLY`, `@REQ: SEC-NO-PII-LOGS`, `@REQ: UI-FOUR-STATES`, `@REQ: MDR-VOCABULARY`).

## Kontekst i Problem
1. Na głównym pulpicie administratora placówki (`/admin` — `apps/web/src/app/(admin)/admin/page.tsx`) wyświetlany był statyczny kafelek KPI „Status systemu: Stabilny”.
2. Kafelek ten był atrapą (hardcoded) i nie dostarczał kierownikowi placówki (`org_admin`) żadnej wartości operacyjnej, a zarazem nie odzwierciedlał rzeczywistych prac serwisowych ani awarii usług.
3. Zarządzanie stanem technicznym platformy oraz ogłaszanie prac naprawczych lub niedostępności konkretnych modułów należy wyłącznie do operatora platformy (`super_admin`).

## Rozwiązanie (Wariant A)
1. **Usunięcie atrapy z pulpitu placówki (`/admin`):**
   - Kafelek „Status systemu: Stabilny” zostaje usunięty z widoku `org_admin` i zastąpiony użytecznym wskaźnikiem operacyjnym ośrodka: **„Raporty do zatwierdzenia”** (liczba raportów dziennych w statusie `draft`).
2. **Globalny Banner Alertu Systemowego (`SystemAlertBanner`):**
   - Renderowany w layoutach placówki (`/admin` oraz `/staff`) wyłącznie wtedy, gdy w systemie istnieje aktywny alert opublikowany przez `super_admin`.
   - Prezentuje poziom ważności (`info`, `warning`, `error`), tytuł, komunikat dla placówek oraz listę dotkniętych modułów (`voice_pipeline`, `wearables`, `notifications`, `platform`).
   - Gdy brak aktywnych alertów — banner nie zajmuje miejsca na ekranie.
3. **Panel Super Admina (`/admin/system-status`):**
   - Dostępny wyłącznie dla roli `super_admin` (pozycja w `AdminSidebar` w sekcji „Zarządzanie platformą”).
   - Pozwala publikować nowe komunikaty o pracach serwisowych / awariach usług oraz jednym kliknięciem zamykać aktywne alerty (przywracając status stabilny).
   - Każda operacja zapisuje niezmienialny ślad w `audit_logs` (`SYSTEM_ALERT_PUBLISHED`, `SYSTEM_ALERT_RESOLVED`) bez danych osobowych.

## Weryfikacja
- Testy logiczne: `tests/logic/system_status_alerts.test.ts`
- Testy E2E Playwright: `e2e/system-status-alerts.spec.ts` (z Page Object Model `e2e/page-objects/SystemStatusPage.ts`)
- Pełna bramka: `bash scripts/verify.sh --full`
