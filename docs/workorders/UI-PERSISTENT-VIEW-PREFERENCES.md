# Work Order: UI-PERSISTENT-VIEW-PREFERENCES

## Wymaganie
Rejestr: SC-ADM-18 (Trwałe zapamiętywanie preferencji widoku UI — Kafelki / Tabela / Obchód)
Powiązane wymagania kontraktowe:
- `@REQ: UI-TEMPLATE-ALIGNMENT`
- `@REQ: UI-ACCESSIBILITY`
- `@REQ: UI-FOUR-STATES`

## Opis
Implementacja mechanizmu trwałego zapamiętywania preferencji widoków w interfejsie użytkownika:
1. **Uniwersalny hook klienta (`useViewPreference`):**
   - Lokalizacja: `apps/web/src/hooks/use-view-preference.ts`.
   - Zapewnia typowany odczyt i zapis z `localStorage` oraz synchroniczne wsparcie bez błędów hydratacji (SSR safe).
   - Walidacja dozwolonych trybów (`allowedModes`), zapobiegająca ustawieniu niepoprawnego stanu w przypadku uszkodzonego magazynu.
2. **Integracja w widokach aplikacji:**
   - **Struktura placówki (`RoomList.tsx` w `/admin/facility`):**
     - Przełącznik: `Kafelki (grid)` vs `Tabela (table)`.
     - Klucz preferencji: `silvercare_facility_rooms_view`.
   - **Tablica personelu (`StaffBoardClient.tsx` w `/staff`):**
     - Przełącznik: `Obchód (rounds)` vs `Standard (standard)`.
     - Klucz preferencji: `silvercare_staff_board_view`.
   - **Organizacje (`OrganizationsManagementClient.tsx` w `/admin/organizations`):**
     - Przełącznik: `Kafelki (cards)` vs `Tabela (table)`.
     - Klucz preferencji: `silvercare_organizations_view`.
   - **Lista podopiecznych (`AdminResidentsPage` / `ResidentsClient.tsx` w `/admin/residents`):**
     - Przełącznik: `Kafelki (cards)` vs `Tabela (table)`.
     - Klucz preferencji: `silvercare_residents_view`.

## Kryteria akceptacji
- **AC1:** Zmiana trybu widoku w dowolnym z obsługiwanych modułów natychmiast utrwala wybór w przeglądarce użytkownika.
- **AC2:** Przeładowanie strony lub ponowne wejście do modułu natychmiast przywraca ostatnio wybrany tryb bez konieczności ponownego klikania.
- **AC3:** Brak ostrzeżeń i błędów hydratacji w konsoli deweloperskiej Next.js.
- **AC4:** Pełne testy jednostkowe pokrywające działanie hooka i walidację dozwolonych trybów (`tests/logic/ui_view_preferences.test.ts`).
