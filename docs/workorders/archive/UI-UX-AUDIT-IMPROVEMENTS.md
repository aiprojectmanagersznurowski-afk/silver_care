# Work Order: UI-UX-AUDIT-IMPROVEMENTS

## Metadane
- **Zadanie:** Wdrożenie poprawek z audytów UI/UX (Logowanie, Portal Rodziny, Panel Admina, Panel Super Admina)
- **Źródło audytów:** `UI/Audyt/`
  - `silvercare-login-audit.md`
  - `silver-care-audyt-portal-rodziny.md`
  - `silver-care-audyt-panel-admina.md`
  - `audyt-ui-silver-care-super-admin.md`
- **Wymagania kontraktowe:** `@REQ: UI-TEMPLATE-ALIGNMENT`, `@REQ: UI-ACCESSIBILITY`
- **Domena:** presentation
- **Ryzyko:** MEDIUM
- **Gałąź:** `feature/ui-ux-audit-improvements`

## Kontekst i Zidentyfikowane Problemy
Przeprowadzone audyty UI/UX w katalogu `UI/Audyt/` wykazały kluczowe usterki w czterech głównych obszarach aplikacji:

### 1. Ekran Logowania (`silvercare-login-audit.md`)
- **Mylące placeholdery i brak autocomplete:** Pole hasła miało placeholder `••••••••` wyglądający jak wpisane hasło; brakowało `autoComplete="username"` / `autoComplete="current-password"` oraz `name` na inputach.
- **Dostępność i nawigacja:** Brak semantycznego `<main>` i `<h1>`; martwy element "Pomoc" (`span` bez akcji) bez ścieżki pomocy przy zapomnianym haśle.
- **Cele dotykowe i przyciski:** Kontrolki poniżej 44px na urządzeniach mobilnych; przycisk Google bez ikony; artefakt tła pod separatorem "Albo".

### 2. Portal Rodziny (`silver-care-audyt-portal-rodziny.md`)
- **P1-1 / P1-2:** Header rozjeżdżający się na tabletach (768px i 935px) — menu `md:flex` włączało się za wcześnie, powodując nakładanie się elementów i zawijanie linków.
- **P0-4:** Na ekranie mobile pole formularza wiadomości (`FamilyMessageForm`) kolidowało z przyklejoną dolną nawigacją.

### 3. Panel Placówki / Administrator (`silver-care-audyt-panel-admina.md`)
- **P0-3:** Na ekranach 390px i 768px przycisk "Dodaj pokój" i pozostałe akcje w nagłówku struktury (`/admin/facility`) były wyrzucane poza ekran z powodu braku `flex-wrap`.
- **P0-4:** W widokach pokoi doklejany był prefiks do wartości już zawierających "Sektor", dając "Sektor Sektor A".

### 4. Panel Super Admina (`audyt-ui-silver-care-super-admin.md`)
- **Kafelki placówek:** W widoku kafelków (`/admin/organizations`) przycisk "Szczegóły" wypadał poza prawą krawędź karty przy dłuższych nazwach i na mobile.
- **Tabela IAM (`/admin/iam`):** Kolumna roli wyświetlała surowe klucze techniczne (`org_admin`, `nurse`) zamiast czytelnych polskich nazw; kolumna placówki pokazywała surowy UUID zamiast identyfikatora biznesowego; selektor roli obcinał tekst na wąskich ekranach.

## Kryteria Akceptacji
1. **Ekran Logowania:**
   - Poprawione placeholdery (usunięte kropki z hasła, czytelny placeholder email), dodane `autoComplete` i `name`.
   - Element "Nie pamiętasz hasła?" z semantycznym linkiem (`<a href="...">`).
   - Semantyczny `<main>` oraz `<h1>` dla "Zaloguj się".
   - Cele dotykowe formularza powiększone do standardu mobile (`h-11 md:h-10`).
   - Przycisk Google wzbogacony o oficjalną ikonę Google.
2. **Portal Rodziny:**
   - Desktop nav w `FamilyHeader.tsx` aktywowana od breakpointu `lg` zamiast `md`, linki z `whitespace-nowrap`, podtytuł schowany na węższych ekranach.
   - Prawidłowy margines dolny w kontenerze wiadomości na mobile nad dolnym paskiem nawigacji.
3. **Panel Placówki:**
   - Pasek akcji w `/admin/facility` z zawijaniem wierszy (`flex-wrap`).
   - Usunięty duplikat prefiksu sektora w `RoomList.tsx`.
4. **Panel Super Admina:**
   - Kafelki placówek w `/admin/organizations` z responsywnym nagłówkiem (`min-w-0 flex-1`, `shrink-0` dla akcji).
   - W tabeli IAM czytelne polskie etykiety ról, identyfikator biznesowy placówki oraz selektor o `min-w-[160px]`.
5. **Jakość i Weryfikacja:**
   - Pełna bramka `bash scripts/verify.sh --full` zielona (6/6).
