# Work Order: Odświeżenie motywu wizualnego Silver Care i strony logowania (UI-DESIGN-SYSTEM-REFRESH)

## Metadane
- **Wymagania:** `UI-FOUR-STATES`, `UI-ACCESSIBILITY`
- **Domena:** presentation
- **Ryzyko:** LOW
- **Powiązania:** `apps/web/src/app/login/page.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/components/AdminSidebar.tsx`, `apps/web/src/components/ui/`, `e2e/auth.spec.ts`, `tests/logic/ui_design_refresh.test.ts`

## Cel
Wdrożenie spójnego, nowoczesnego motywu wizualnego Silver Care opartego o wzorce shadcn dashboard (z zachowaniem kanonicznej palety kolorów "Ciepłe Zaufanie" oraz logo) wraz z pełnym odświeżeniem strony logowania w oparciu o komponent z 21st.dev (canvas z animowanymi cząsteczkami, linie akcentowe, glassmorphism, zaawansowane stany pól).

## Zakres prac
1. **Odświeżenie strony logowania (`/login`):**
   - Adaptacja komponentu 21st.dev (`UI/login_template.md`): animacja canvasu cząsteczek, linie akcentowe `.accent-lines`, płynne wyłanianie karty `.card-animate`,
   - Zachowanie tożsamości marki Silver Care: logo `/logo.png`, paleta barw (Ciepła biel `#FBFAF8`, kojąca zieleń szałwiowa `#2F6F5E`, tekst `#1C1B19`, bordery `#E8E4DD`),
   - Utrzymanie pełnej kompatybilności funkcjonalnej: logowanie hasłem, obsługa OAuth (Google), obsługa linków zaproszeń/resetu hasła w hashu URL,
   - Zapewnienie zgodności ze wszystkimi selektorami i asercjami testów Playwright E2E (`LoginPage.ts`, `auth.spec.ts`).
2. **Rozbudowa i unifikacja biblioteki komponentów shadcn (`apps/web/src/components/ui`):**
   - Dodanie komponentu `Checkbox` (`@base-ui/react/checkbox`),
   - Dodanie komponentów wspierających: `Tooltip`, `Skeleton`, `Breadcrumb`,
   - Unifikacja stylistyki kart, inputów i przycisków.
3. **Spójny motyw dashboardu:**
   - Uzupełnienie zmiennych tematycznych w `globals.css` dla sidebara i kart,
   - Odświeżenie `AdminSidebar.tsx` w nowoczesnym stylu shadcn z zachowaniem ergonomii dostępności (WCAG AA).
4. **Weryfikacja jakościowa:**
   - Testy jednostkowe weryfikujące tokeny, eksporty komponentów i logikę (`tests/logic/ui_design_refresh.test.ts`),
   - Testy E2E Playwright (`e2e/auth.spec.ts` i przepływy ról).
