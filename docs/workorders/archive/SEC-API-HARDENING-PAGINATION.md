# Work Order: SEC-API-HARDENING-PAGINATION

## Wymagania
Rejestr: SEC-SESSION, SEC-403-LOGGING, SEC-NO-PII-LOGS, ORG-ISOLATION, ADM-RESIDENT-ADD, INFRA-EU-REGION

## Opis
Implementacja pozostałych zadań optymalizacyjnych i zabezpieczających z audytu technicznego (Karty Trello #16-#22):
1. [Karta 16] `SEC-API-WRAPPER`: Centralny wrapper autoryzacyjny `withAuth` w `apps/web/src/lib/api-auth.ts` weryfikujący sesję, token Bearer, role RBAC i kontekst placówki.
2. [Karta 20] `SEC-API-ERRORS`: Centralna obsługa błędów API `handleApiError` w `apps/web/src/lib/api-errors.ts` maskująca błędy bazodanowe i chroniąca przed wyciekiem PII.
3. [Karta 21] `INFRA-ENV-SPEC`: Pliki konfiguracyjne `.env.example` w katalogu głównym i `apps/web/.env.example` z pełną specyfikacją zmiennych środowiskowych.
4. [Karta 17] `INFRA-TYPING`: Generowanie typów Supabase `Database` i skrypt `pnpm db:types` (`tools/sc-generate-types.mjs`).
5. [Karta 18] `ADM-PAGINATION`: Paginacja serwerowa w endpointach (np. `GET /api/residents`) oraz kontrolki stronicowania.
6. [Karta 22] `ADM-JSONB-SCHEMA`: Walidacja integralności pola `daily_logs.data`.
7. [Karta 19] `UI-REFACTOR-MONOLITH`: Modularyzacja komponentów `IamManagementClient` i `StaffBoardClient`.

## Kryteria akceptacji
- AC1: `withAuth` blokuje nieautoryzowane zapytania statusem 401 i odmowy ról statusem 403 z logowaniem zdarzeń technicznych.
- AC2: `handleApiError` uniemożliwia wyciek zapytań SQL i danych PII do klienta.
- AC3: Plik `.env.example` dokumentuje komplet wymaganych zmiennych bez sekretów produkcyjnych.
- AC4: Skrypt `pnpm db:types` generuje aktualne typy `database.types.ts`.
- AC5: `GET /api/residents?page=1&limit=20` zwraca dane z obiektem `pagination`.
- AC6: Kompilacja `pnpm --filter web build` oraz pełna bramka `bash scripts/verify.sh --full` są zielone (6/6).
