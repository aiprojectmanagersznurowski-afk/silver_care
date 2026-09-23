# Decyzja AUTO-2026-09-23: Architektura Playwright E2E i Dostępność Strony 403

## Kontekst
Wdrożenie autonomicznych testów End-to-End (E2E) w projekcie Silver Care na podstawie User Stories oraz rejestru wymagań (`contracts/requirements.contract.mjs`).

## Decyzja 1: Struktura Page Object Model w katalogu `e2e/`
- **Wybrana opcja (Rekomendowana):** Wydzielenie `e2e/fixtures/` oraz `e2e/page-objects/`, gdzie każdy widok frontendu posiada dedykowaną klasę POM, a testy `*.spec.ts` importują rozszerzony obiekt `test` z wstrzykniętymi instancjami. Każdy plik testowy nosi tag `@REQ: <ID>` wymagany przez `tools/sc-trace.mjs --enforce`.
- **Odrzucona alternatywa:** Płaskie testy w `e2e/` ze zduplikowanymi selektorami DOM w każdym teście. Odrzucono ze względu na brak skalowalności i utrudnione autonomiczne rozszerzanie przy kolejnych scenariuszach na froncie.

## Decyzja 2: Dołączenie `/unauthorized` do `isPublicRoute` w Middleware
- **Wybrana opcja (Rekomendowana):** Dodanie `path.startsWith('/unauthorized')` do listy tras publicznych w `apps/web/src/lib/supabase/middleware.ts`. Umożliwia to wyświetlenie użytkownikowi strony z kodem 403 i wyjaśnieniem odmowy dostępu, zamiast wpadania w pętlę przekierowań do `/login`.
- **Odrzucona alternatywa:** Pozostawienie `/unauthorized` jako trasy chronionej, co powodowało, że niezalogowany użytkownik trafiający na 403 nie widział komunikatu błędu, lecz był przekierowywany na stronę logowania.

## Wpływ na Kontrakt i Granice Prawne
Brak. Zmiany mieszczą się w klasie AUTO_LOGGED / AUTO bez wpływu na `contracts/`, dane osobowe (art. 9) czy granicę MDR.
