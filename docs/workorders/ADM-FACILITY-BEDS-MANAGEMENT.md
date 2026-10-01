# Work Order: ADM-FACILITY-BEDS-MANAGEMENT

## 1. Cel i kontekst biznesowy
Zarządzanie strukturą pokoi i łóżek w placówce w module `/admin/facility`:
- Dostępność dwóch ergonomicznych trybów widoku: Kafelki (grid) oraz Tabela (zwarta lista z kolumnami).
- Zaawansowane filtrowanie po piętrze, sektorze, stanie obłożenia oraz frazie wyszukiwania.
- Transparentne reguły przypisania łóżek (zgodność płci, preferencje ZSN i mobilności).
- Wygodny dialog edycji i atomowego przeniesienia pensjonariusza (`ReassignBedDialog`) z wykorzystaniem procedury `transfer_resident_bed` i rejestracją w audycie.
- Wdrożenie czystego feedbacku (Toast, ConfirmDialog) eliminującego okna przeglądarki `alert()` i `confirm()`.

Powiązane wymagania kontraktowe:
- `@REQ: ADM-FACILITY-MANAGE`
- `@REQ: ADM-BED-ASSIGNMENT`
- `@REQ: ADM-FACILITY-OCCUPANCY`

## 2. Kryteria Akceptacji (AC)
- **AC1: Widok kafelkowy i tabelaryczny pokoi:**
  Przełącznik trybu widoku (`Kafelki` / `Tabela`) z zachowaniem stanu w preferencjach i płynnym renderowaniem.
- **AC2: Zaawansowane filtry struktury placówki:**
  Filtrowanie per piętro (Parter, 1. piętro, itd.), sektor (A, B, C...) oraz obłożenie (Wszystkie, Z wolnymi łóżkami, W pełni zajęte) z wyszukiwarką.
- **AC3: Transparentne reguły przypisania łóżka:**
  Informacja o płci w pokoju (kobiecy/męski/mieszany/wolny), preferencji ZSN (parter dla pensjonariuszy ze specjalnymi potrzebami) oraz poziomie opieki.
- **AC4: Wygodna edycja i przeniesienie pensjonariusza:**
  Dialog przeniesienia na inne wolne łóżko z walidacją reguł, atomowym wywołaniem `transfer_resident_bed` i powiadomieniem `toast.success`.

## 3. Plan wdrożenia (Faza RED → GREEN → VERIFY)
1. **Faza RED (Testy jednostkowe & E2E):**
   - Dodanie testów jednostkowych w `tests/logic/facility_beds_management.test.ts`.
   - Dodanie testów Playwright E2E w `e2e/facility-beds-management.spec.ts` z Page Object `e2e/page-objects/FacilityPage.ts`.
2. **Faza GREEN (Implementacja):**
   - Utworzenie `ReassignBedDialog.tsx` dla płynnego przenoszenia pensjonariusza.
   - Rozbudowa `RoomList.tsx` o przełącznik `Kafelki` / `Tabela` oraz zaawansowane filtry.
   - Wdrożenie transparentnych plakietek z regułami (płeć, ZSN, piętro) na kartach pokoi i w tabeli.
   - Modernizacja `BedList.tsx` (zastąpienie `alert`/`confirm` komponentami `ConfirmDialog` i `toast`).
3. **Faza VERIFY:**
   - Wykonanie `bash scripts/verify.sh --full`.
   - Wykonanie `pnpm test:e2e e2e/facility-beds-management.spec.ts`.
