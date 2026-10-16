# Work Order: UI do odczytu i odpowiedzi na wiadomości od rodzin (NUR-MESSAGES-INBOX)

## Metadane
- **Wymagania:** `FAM-MESSAGES`, `NUR-BOARD`
- **Trello Card:** `UI do odczytu wiadomosci od rodzin` (ID: `6abe7285fa91502420e0396f`)
- **Domena:** staff / presentation
- **Ryzyko:** LOW (wykorzystanie istniejących endpointów API i tabeli `family_messages`)
- **Powiązania:** 
  - `apps/web/src/app/(staff)/staff/messages/page.tsx`
  - `apps/web/src/components/StaffMessagesInbox.tsx`
  - `apps/web/src/components/StaffSidebar.tsx`
  - `apps/web/src/components/StaffMobileHeader.tsx`
  - `apps/web/src/components/StaffBoardClient.tsx`
  - `apps/web/src/app/api/admin/messages/route.ts`

---

## Cel
Umożliwienie personelowi dyżurującemu (`nurse`, `caregiver`, `org_admin`) szybkiego i czytelnego przeglądania wiadomości pozostawionych przez rodziny podopiecznych oraz **udzielania odpowiedzi bezpośrednio z poziomu panelu personelu** bez konieczności telefonowania.

---

## Kryteria Akceptacji (Given-When-Then)

### AC1: Dostępność widoku wiadomości w panelu personelu
- **GIVEN** zalogowany pracownik personelu na ścieżce `/staff`.
- **WHEN** spogląda na menu boczne (`StaffSidebar`) lub menu mobilne (`StaffMobileHeader`).
- **THEN** widzi pozycję „Wiadomości” (`/staff/messages`) z ikoną komunikacji (`MessageSquare`).
- **AND** kliknięcie przenosi na dedykowaną stronę `/staff/messages`.

### AC2: Skrzynka odbiorcza i lista wątków per podopieczny
- **GIVEN** wejście na `/staff/messages`.
- **WHEN** placówka posiada zarejestrowane wiadomości od rodzin.
- **THEN** widoczna jest lista wątków pogrupowana według podopiecznych (imię, nazwisko, data ostatniej wiadomości, podgląd treści).
- **AND** możliwość wyszukiwania podopiecznego po imieniu lub nazwisku.

### AC3: Podgląd pełnej konwersacji
- **GIVEN** wybranie podopiecznego z listy wątków.
- **WHEN** pracownik klika na dany wątek.
- **THEN** w głównym panelu wyświetla się chronologiczny ciąg wiadomości w estetycznych dymkach (wyróżnienie nadawcy: rodzina vs personel, znaczniki czasu).
- **AND** nagłówek wątku wyświetla imię i nazwisko podopiecznego oraz datę/godzinę.

### AC4: Pole odpowiedzi i wysyłanie wiadomości do rodziny
- **GIVEN** aktywny wątek konwersacji z rodziną.
- **WHEN** pracownik wpisuje treść odpowiedzi w polu tekstowym i klika „Wyślij” (lub wciska Enter).
- **THEN** żądanie `POST /api/admin/messages` tworzy rekord w `family_messages` z `is_from_family = false`, `staff_user_id = user.id`.
- **AND** nowa wiadomość natychmiast pojawia się w widoku konwersacji, a pole wprowadzania zostaje wyczyszczone.
- **AND** w przypadku błędu sieci/uprawnień wyświetlany jest czytelny komunikat (toast / alert inline), bez blokowania UI.

### AC5: Informacja o wiadomościach na pulpicie podopiecznych (`StaffBoardClient`)
- **GIVEN** kafelek pensjonariusza na liście `/staff`.
- **WHEN** dla danego pensjonariusza wpłynęła wiadomość od rodziny.
- **THEN** widoczny jest przycisk/skrót akcji prowadzący bezpośrednio do wiadomości tego pensjonariusza (`/staff/messages?residentId=...`).

### AC6: Bezpieczeństwo i rygor prawny (Art. 9 RODO i MDR)
- **GIVEN** pobieranie i wysyłanie wiadomości.
- **WHEN** wykonywane jest zapytanie API.
- **THEN** weryfikowana jest organizacja pracownika (`organization_id = get_jwt_organization_id()`).
- **AND** wiadomości są niezmienialne po wysłaniu (append-only ledger).

---

## Plan Implementacji

1. **Nowoczesny komponent `StaffMessagesInbox`:**
   - Wykorzystanie design systemu Silver Care (sage, slate, cream, avatary, responsywny podział lista wątków ↔ okno czatu).
   - Formularz wprowadzania odpowiedzi z obsługą stanu `isSubmitting`, blokadą pustych wiadomości i obsługą klawisza Enter.
   - Obsługa 4 stanów UI: `loading`, `empty`, `error`, `success`.

2. **Podstrona `/staff/messages`:**
   - `apps/web/src/app/(staff)/staff/messages/page.tsx` w grupie `(staff)` z ochroną autoryzacyjną.
   - Obsługa query param `?residentId=...` do automatycznego otwarcia wątku wskazanego pensjonariusza.

3. **Nawigacja personelu (`StaffSidebar` i `StaffMobileHeader`):**
   - Dodanie linku „Wiadomości” z ikoną `MessageSquare`.

4. **Integracja z kafelkiem pensjonariusza w `StaffBoardClient`:**
   - Dodanie linku/skrótu do wiadomości danego pensjonariusza.

5. **Testy jednostkowe & E2E:**
   - Testy renderowania i logiki skrzynki wiadomości w `tests/`.
