# Work Order: VOICE-RESIDENT-FALLBACK-NAVIGATION

## Cel
Likwidacja martwego ekranu w module notatki głosowej (`/voice`) w przypadku braku parametru podopiecznego w URL poprzez dodanie selektora/wyszukiwarki podopiecznych, trwałego przycisku powrotu do `/staff` („Wróć do tablicy dyżuru”) oraz wpięcie odnośnika do notatki głosowej w pasku bocznym personelu (`StaffSidebar`).

## Zakres wdrożenia
1. **Moduł notatki głosowej (`apps/web/src/app/(staff)/voice/page.tsx`):**
   - Gdy brak `residentId`: prezentacja wyszukiwarki i listy podopiecznych do wyboru zamiast statycznego komunikatu o braku ID.
   - Dodanie trwałego linku/przycisku powrotu: *„Wróć do tablicy dyżuru”* (`/staff`).
2. **Pasek boczny personelu (`apps/web/src/components/StaffSidebar.tsx`):**
   - Dodanie pozycji *„Notatka głosowa”* (`/voice`) z ikoną mikrofonu (`Mic`) w grupie *„Dyżur”*.
