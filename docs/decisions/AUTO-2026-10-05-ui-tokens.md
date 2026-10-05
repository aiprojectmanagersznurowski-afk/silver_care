# AUTO_LOGGED — tokeny CSS z prefiksem `--sc-` i tryb ciemny przez `.dark` (2026-10-05)

**Kontekst.** `UI-TEMPLATE-ALIGNMENT` (ADR-014) podłącza wygenerowany `tokens.css` do `apps/web`. Do tej pory plik nie był nigdzie importowany, a `globals.css` miał wartości wpisane ręcznie.

**Decyzja 1: prefiks `--sc-` w tokenach.** Kontrakt nazywa kolor marki `accent`, a shadcn używa `--accent` dla tła stanu hover. Bez prefiksu import `tokens.css` nadpisałby zmienne komponentów. `globals.css` mapuje zmienne shadcn na tokeny (`--primary: var(--sc-accent)`, `--accent: var(--sc-accent-soft)`).
- Odrzucona alternatywa: zmiana nazw w kontrakcie na słownik shadcn. Odrzucona, bo kontrakt opisuje znaczenie (akcent marki, tło sunken), a słownik shadcn jest szczegółem biblioteki — przy zmianie biblioteki kontrakt by się zdezaktualizował.

**Decyzja 2: tryb ciemny przez klasę `.dark`.** Aplikacja definiuje `@custom-variant dark (&:is(.dark *))`. Tokeny przełączane przez `prefers-color-scheme` włączałyby ciemne tło przy jasnych komponentach.
- Odrzucona alternatywa: zostawić `prefers-color-scheme`. Odrzucona — dwa niezależne mechanizmy przełączania dają niespójny interfejs.

**Konsumenci.** Przed zmianą żaden plik nie importował `tokens.css` ani nie używał zmiennych bez prefiksu (`grep var(--bg)` itp. w `apps/web` — brak wyników), więc zmiana nazw nie psuje istniejącego kodu.
