# Work Order: Standaryzacja middleware Next.js dla ochrony tras na brzegu sieci (SEC-MIDDLEWARE-EDGE)

## Wymaganie
W frameworku Next.js (App Router) ochrona tras na poziomie brzegu sieci (Edge Runtime) wymaga pliku `src/middleware.ts` eksportującego funkcję `middleware`.
Dotychczasowy plik `src/proxy.ts` z funkcją `proxy` nie był automatycznie wpinany w cykl życia żądań Next.js.
Dodatkowo autoryzacja ról w `updateSession` powinna opierać się na `app_metadata.role` (usuwając podatność `user_metadata`).

Wymagania powiązane w kontrakcie:
- `SEC-SESSION`: Uwierzytelnianie i ochrona sesji użytkowników.
- `SEC-403-LOGGING`: Blokada i przekierowanie nieautoryzowanych prób dostępu.
- `ORG-ISOLATION`: Izolacja paneli administracyjnych i personelu przed dostępem z zewnątrz.

## Cele
1. Utworzyć standardowy `apps/web/src/middleware.ts` z eksportem `middleware(request: NextRequest)` i konfiguracją matchera.
2. Usunąć przestarzały `apps/web/src/proxy.ts`.
3. Poprawić `updateSession` w `apps/web/src/lib/supabase/middleware.ts`, aby sprawdzał wyłącznie `app_metadata.role`.
4. Napisać test jednostkowy sprawdzający zachowanie middleware (przekierowania dla nieautoryzowanych ról, brak sesji itp.).
5. Zweryfikować poprawność budowania aplikacji webowej (`pnpm --filter web build`) oraz przejście pełnej bramki `bash scripts/verify.sh --full`.
