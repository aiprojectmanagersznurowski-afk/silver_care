# Work Order: SEC-INVITE-TOKEN-EXPOSURE

## Metadane
- **Zadanie Trello:** `SEC-INVITE-TOKEN-EXPOSURE: endpoint zaproszeń zwraca link z tokenem i loguje go bez klucza e-mail` (#166)
- **ID Karty Trello:** `6ac5272a4993d9cdddde7d96`
- **Wymagania:** `@REQ: ADM-INVITE`, `@REQ: SEC-NO-PII-LOGS`
- **Domena:** security / residents
- **Ryzyko:** HIGH
- **Gałąź:** `fix/sec-invite-token-exposure`

## Kontekst i Problem
1. W trasie API `POST /api/family/invite` (`apps/web/src/app/api/family/invite/route.ts`):
   - W linii 132 kod wypisywał pełen link z tokenem zaproszenia do logów (`console.log('[MOCK EMAIL] Brak EMAIL_PROVIDER_KEY. Link: ${registerUrl}')`), co narusza `@REQ: SEC-NO-PII-LOGS` (zakaz logowania danych wrażliwych i tokenów dostępowych).
   - W linii 135 kod bezwarunkowo zwracał `{ success: true, url: registerUrl, id: data.id }` z komentarzem `// Returning url and id for testing purposes`.
2. W środowisku produkcyjnym token zaproszenia umożliwia powiązanie konta bliskiego z pensjonariuszem placówki. Link i token nie mogą wyciekać w odpowiedzi produkcyjnego API.
3. W interfejsie użytkownika (`InviteFamilyDialog.tsx`) okno dialogowe powinno obsługiwać wysłanie e-maila jako główny scenariusz produkcyjny (komunikat potwierdzenia wysłania e-maila na podany adres), a pole z linkiem prezentować tylko wówczas, gdy odpowiedź rzeczywiście zawiera `url` (np. lokalne środowisko developerskie/testowe).

## Kryteria Akceptacji
1. `POST /api/family/invite` nie wypisuje `registerUrl` ani surowego tokenu do logów serwera.
2. Odpowiedź API w trybie produkcyjnym (`process.env.NODE_ENV === 'production'`) nie zawiera pól `url` ani `id` — zwraca wyłącznie status operacji i flagę `emailSent`.
3. W środowisku testowym/deweloperskim endpoint może opcjonalnie udostępniać pomocnicze pola do celów testów manualnych, jeśli jest to wyraźnie dozwolone.
4. Komponent `InviteFamilyDialog.tsx` poprawnie obsługuje odpowiedź bez zwracanego pola `url`: informuje o pomyślnym wysłaniu wiadomości e-mail do rodziny.
5. Wszystkie testy jednostkowe i bramka weryfikacyjna przechodzą w 100%.
