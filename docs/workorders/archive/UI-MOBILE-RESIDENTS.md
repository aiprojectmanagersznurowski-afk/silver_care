# Work Order: UI-MOBILE-RESIDENTS

## Wymaganie
Rejestr: UI-ACCESSIBILITY (NFR-UI-01/AC3), UI-FOUR-STATES (NFR-UI-01/AC1)
Trello: Karta #0 — UI-MOBILE-RESIDENTS (Lista Presentation MDR/UI)

## Opis
Responsywny widok bazy podopiecznych dla urządzeń mobilnych:
1. W rzutniach mobilnych (< 640px / sm) zamiast sztywnej 7-kolumnowej tabeli renderowana jest lista responsywnych kart podopiecznych (`ResidentMobileCard`).
2. Karta podopiecznego prezentuje kluczowe informacje: avatar, imię i nazwisko z linkiem do profilu 360°, status, pokój i łóżko, datę przyjęcia oraz szybkie akcje (inline care level, ZSN checkbox, edycja w arkuszu bocznym).
3. Minimalny touch target kontrolek interaktywnych wynosi co najmniej 44x44px.
4. Naprawa błędu stylów CSS w `ResidentInlineCareLevel` (zastąpienie niepoprawnego CSS var z heksową przezroczystością klasami `CARE_LEVEL_BG_CLASSES`).
5. Zastąpienie custom dropdownu w `ResidentInlineCareLevel` dostępnym komponentem `DropdownMenu` opartym na portalu.
6. Naprawa dostępności i touch targetu w `ResidentZsnCheckbox`.
7. Usunięcie `window.location.reload()` z `AddResidentDialog` na rzecz `router.refresh()`.

## Kryteria akceptacji
- AC1: Na ekranie mobilnym (< 640px) strona `/admin/residents` wyświetla listę kafelkową kart zamiast przewijanej tabeli.
- AC2: Na ekranie desktopowym (>= 640px) strona nadal wyświetla pełną tabelę.
- AC3: Wszystkie przyciski dotykowe i interaktywne kontrolki na karcie mobilnej mają minimalny rozmiar 44x44px.
- AC4: Zmiana poziomu opieki oraz statusu ZSN z poziomu karty mobilnej aktualizuje dane optymistycznie.
- AC5: Przycisk edycji na karcie otwiera `ResidentEditSheet` z danymi podopiecznego.
