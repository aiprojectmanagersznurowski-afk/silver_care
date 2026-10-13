# Work Order: UI-GLOBAL-SEARCH

## Wymaganie
Rejestr: SC-ADM-17 (Pełnofunkcyjna wyszukiwarka globalna — Command Palette / Spotlight Cmd+K)
Powiązane wymagania kontraktowe:
- `@REQ: UI-TEMPLATE-ALIGNMENT`
- `@REQ: UI-ACCESSIBILITY`
- `@REQ: ORG-ISOLATION`
- `@REQ: SEC-NO-PII-LOGS`
- `@REQ: MDR-VOCABULARY`

## Opis
Implementacja pełnofunkcyjnej, globalnej wyszukiwarki typu Command Palette (Spotlight / Cmd+K / Ctrl+K) w systemie Silver Care:
1. **Wspólny kontrakt DTO (`SearchCategoryKey`, `SearchResultItem`, `GlobalSearchResult`):**
   - Kategorie: `residents`, `facility` (pokoje i łóżka), `agenda` (plan dnia), `reports` (raporty codzienne), `staff` (personel i opiekunowie prawni), `organizations` (wyłącznie dla roli super_admin).
   - Pola: `id`, `title`, `subtitle`, `href`, `category`, `badge`, `badgeVariant`.
2. **Backend Server Action & Endpoint (`/api/search` / `searchGlobalAction`):**
   - Weryfikacja tożsamości i uprawnień użytkownika w Supabase Auth.
   - Ścisła izolacja placówki (`organization_id = userOrgId`) zapobiegająca wyciekowi danych między placówkami (`ORG-ISOLATION`).
   - Wyszukiwanie równoległe (Promise.allSettled) z ograniczeniem wyników (limit per kategoria).
   - Pełna zgodność z MDR i RODO: bezwzględny zakaz słowa „pacjent”, brak wyszukiwania po PESEL w plaintext, zero danych medycznych w podtytułach raportów i planu dnia, brak logowania PII w logach serwera (`SEC-NO-PII-LOGS`, `MDR-VOCABULARY`).
3. **Komponent UI Command Palette (`GlobalCommandPalette`):**
   - Skrót globalny `Cmd+K` / `Ctrl+K` oraz elegancki przycisk w headerze szablonu shadcn-admin (`(admin)/layout.tsx` i `(staff)/layout.tsx`).
   - Pełna dostępność klawiaturowa: strzałki góra/dół (`ArrowUp` / `ArrowDown`), `Enter` do nawigacji, `Escape` do zamknięcia (`UI-ACCESSIBILITY`).
   - 4 stany interfejsu: loading, empty z podpowiedzią, success pogrupowane w sekcje, error (`UI-FOUR-STATES`).
   - Szybkie filtry kategorii (pigułki / filtry pod polem wyszukiwania).
   - Wygląd klasy enterprise w standardzie shadcn-admin (styl nova / tokens.css).

## Kryteria akceptacji
- **AC1:** Skrót Cmd+K / Ctrl+K oraz kliknięcie przycisku w nagłówku otwiera wycentrowaną paletę Spotlight na dowolnym ekranie administracyjnym i personelu.
- **AC2:** Wyszukiwarka zwraca poprawne rekordy dla pensjonariuszy (z numerem pokoju i łóżkiem), pokoi i łóżek, planu dnia, raportów personelu, kontaktów personelu/opiekunów oraz placówek (dla super_admin).
- **AC3:** Ścisła izolacja: użytkownik placówki A nigdy nie otrzymuje żadnych wyników z placówki B (`ORG-ISOLATION`).
- **AC4:** Bezpieczeństwo i język: brak PESEL w plaintext, zero PII w logach, brak słowa „pacjent” w żadnym elemencie UI ani odpowiedzi API.
- **AC5:** Pełna obsługa nawigacji klawiaturą (góra, dół, enter, escape) oraz debouncing zapytań (< 250ms opóźnienia).
