# Work Order: Tablica Pielęgniarek (NUR-BOARD)

## Metadane
- **Wymagania:** `NUR-BOARD`
- **Domena:** staff
- **Ryzyko:** MEDIUM
- **Powiązania:** `tests/logic/nur_board.test.ts`, `tests/logic/ui.test.ts`, `packages/contracts/src/ui/nurse.ts`

## Cel
Udostępnienie personelowi dyżurującemu centralnego widoku tablicy pensjonariuszy z natychmiastową widocznością statusu notatek i raportów dziennych (gotowy / szkic / brak) oraz filtrowaniem po piętrach/oddziałach.

## Kryteria Akceptacji
1. Tablica prezentuje listę przypisanych pensjonariuszy z jednoznacznym statusem notatki:
   - `ready`: istnieje opublikowany raport dzienny (`PUBLISHED`),
   - `draft`: istnieje robocza notatka głosowa lub szkic raportu (`DRAFT`),
   - `none`: brak notatek w bieżącym dniu.
2. Możliwość szybkiego filtrowania listy pensjonariuszy według lokalizacji (piętro/oddział).
3. Wsparcie dla stanu aktywnego dyżuru (`activeShift`).

## Podsumowanie Realizacji
- **KONTRAKT:** Zdefiniowano kontrakt stanu tablicy personelu w `packages/contracts/src/ui/nurse.ts`.
- **LOGIKA I TESTY:** W `tests/logic/nur_board.test.ts` oraz `tests/logic/ui.test.ts` zaimplementowano i przetestowano funkcję wyliczania statusu notatek (`getNoteStatus`) oraz filtrowanie po piętrze (`@REQ: NUR-BOARD`).
