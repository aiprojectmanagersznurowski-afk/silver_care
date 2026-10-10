# Work Order: UI-MOBILE-RESPONSIVE-STAFF-ADMIN

## Metadane
- **Zadanie:** Responsywność menu szuflady personelu i administratora
- **Wymagania kontraktowe:** `@REQ: UI-ACCESSIBILITY`, `@REQ: UI-TEMPLATE-ALIGNMENT`
- **Domena:** presentation
- **Ryzyko:** MEDIUM
- **Trello Card:** `6ac931ee5ae92c307a159446` (Kolumna: Staff NUR)

## Kontekst i Problem
1. **Brak zamykania szuflady mobilnej (`Sheet`) po kliknięciu linku:**
   W `apps/web/src/components/SidebarNav.tsx` i `SidebarAccount.tsx` po otwarciu menu na smartfonie i kliknięciu dowolnego linku, szuflada pozostaje na ekranie, zasłaniając nowo otwartą stronę. Użytkownik musi ręcznie kliknąć backdrop, aby zamknąć menu.
2. **Ukryty przycisk zamknięcia (X):**
   W `apps/web/src/components/ui/sidebar.tsx` w komponencie mobilnego `SheetContent` ustawiono klasę `[&>button]:hidden`, która całkowicie ukrywa przycisk "X" zamykający szufladę.
3. **Ściskanie nagłówka w tablicy dyżurnej (`StaffBoardClient.tsx`):**
   Etykieta "Szybki obchód (Quick-Rounds)" w `ToggleGroup` na małych ekranach (< 640px) zajmuje za dużo miejsca i rozpycha nagłówek.

## Zakres zmian
- `SidebarNav.tsx`: Dodanie obsługi automatycznego zamykania mobilnego paska (`setOpenMobile(false)` z `useSidebar()`) po kliknięciu elementu nawigacyjnego oraz przy zmianie `pathname`.
- `SidebarAccount.tsx`: Dodanie automatycznego zamykania mobilnego paska przy kliknięciu linku profilu.
- `ui/sidebar.tsx`: Przywrócenie widoczności i dostępności przycisku zamknięcia w szufladzie mobilnej.
- `StaffBoardClient.tsx`: Responsywny tekst przycisku w `ToggleGroup` (krótka etykieta "Obchód" na mobilkach `< sm`, pełna od `sm:`).

## Kryteria Akceptacji (AC)
- **AC1:** Po kliknięciu dowolnej pozycji w mobilnym menu panelu personelu i administratora szuflada zamyka się natychmiast, odsłaniając stronę docelową.
- **AC2:** Szuflada mobilna posiada widoczny, klikalny przycisk zamknięcia.
- **AC3:** Nagłówek tablicy dyżurnej personelu zachowuje estetyczny układ bez ściskania na urządzeniach mobilnych.
- **AC4:** Pełna bramka weryfikacyjna (`bash scripts/verify.sh --full`) przechodzi w 100% na zielono.
