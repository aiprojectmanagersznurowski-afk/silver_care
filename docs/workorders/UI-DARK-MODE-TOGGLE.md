# Work Order: UI-DARK-MODE-TOGGLE

**Status:** W TRAKCIE  
**Data rozpoczęcia:** 2026-10-08  
**Domena:** presentation / UI  
**Powiązane karty:** [6ac5272b2dd080413af9692a] `UI-DARK-MODE-TOGGLE: przełącznik trybu ciemnego (niski priorytet)`  
**Wymagania kontraktowe:** `@REQ: UI-TEMPLATE-ALIGNMENT`, `@REQ: UI-ACCESSIBILITY`  
**Standardy:** NFR-UI-01, NFR-UI-03, WCAG 2.1 AA  

---

## 1. Kontekst i cel biznesowy
Tokeny kolorystyczne trybu ciemnego (`.dark`) zostały zdefiniowane w kontrakcie `contracts/design.contract.mjs` i wygenerowane w `tokens.css` oraz zmapowane na zmienne CSS shadcn w `apps/web/src/app/globals.css`.
Dotychczas w aplikacji brakowało jednak interaktywnego przełącznika motywu, przez co użytkownicy nie mieli możliwości aktywacji trybu ciemnego, ani dopasowania go do preferencji systemowych (`prefers-color-scheme`).

Celem zadania jest:
1. Wdrożenie lekkiego, bezbłędnego mechanizmu motywu (`light`, `dark`, `system`) z persystencją w `localStorage` (`sc-theme`).
2. Zapobieżenie miganiu białego tła (Flash of Unstyled Content — FOUC) poprzez skrypt inicjalizacyjny w nagłówku strony.
3. Dodanie dostępnego komponentu `ThemeToggle` z etykietami `aria-label` i ikonami `Sun` / `Moon` w kluczowych miejscach aplikacji:
   - W stopce paska bocznego personelu i administratora (`SidebarAccount`),
   - W nagłówku portalu rodziny (`FamilyHeader`),
   - Na stronie ustawień profilu (`/settings/profile`).

---

## 2. Kryteria akceptacji
- **AC1:** Dostępne trzy stany motywu: `light`, `dark`, `system` (domyślny).
- **AC2:** Wybór jest zapisywany w `localStorage` pod kluczem `sc-theme`.
- **AC3:** Klasa `.dark` jest dynamicznie dodawana/usuwana z elementu `<html>` (`document.documentElement`).
- **AC4:** Brak efektu FOUC przy odświeżeniu strony.
- **AC5:** Komponent `ThemeToggle` spełnia WCAG 2.1 AA (kontrast, obsługa klawiaturą, czytelna etykieta `aria-label`).
- **AC6:** Zero zewnętrznych ciężkich bibliotek — czysta implementacja React 19 / TypeScript zgodna z architekturą Next.js App Router.

---

## 3. Plan wdrożenia
1. **Faza RED:** Utworzenie testu logicznego `tests/logic/ui_dark_mode_toggle.test.ts` weryfikującego strukturę, zachowanie stanu, klasy `.dark`, obsługę klucza `sc-theme` i znaczniki `@REQ`.
2. **Faza GREEN:**
   - Utworzenie biblioteki narzędziowej i kontekstu/hooka motywu `apps/web/src/lib/theme.ts` oraz `apps/web/src/components/ThemeProvider.tsx`.
   - Utworzenie komponentu `apps/web/src/components/ThemeToggle.tsx`.
   - Dodanie skryptu anty-FOUC do `apps/web/src/app/layout.tsx`.
   - Osadzenie `ThemeToggle` w `SidebarAccount.tsx` i `FamilyHeader.tsx`.
3. **Faza VERIFY:** Uruchomienie pełnej bramki `bash scripts/verify.sh --full`.
