# Work Order: SEC-AUDIT-HARDENING

## Wymagania
Rejestr: SEC-403-LOGGING, ORG-ISOLATION, SEC-SESSION, SEC-RETENTION

## Opis
Mitygacja krytycznych i wysokich ryzyk z audytu technicznego kodu:
1. Uszczelnienie ochrony tras API w `apps/web/src/lib/supabase/middleware.ts` — usunięcie `path.startsWith('/api')` z tras publicznych, wydzielenie precyzyjnej białej listy endpointów publicznych (`/api/family/invite/validate`, `/api/family/register`, `/api/polar/webhook`).
2. Bezpieczny kryptograficznie generator haseł tymczasowych (`crypto.randomBytes`) w `apps/web/src/actions/iam.ts` oraz `apps/web/src/lib/staff-helpers.ts` zamiast `Math.random()`.
3. Rejestracja wpisu audytowego `RESIDENT_DELETED` w `apps/web/src/actions/admin.ts` przed fizycznym usunięciem pensjonariusza (zgodność z brakiem PII w audycie).
4. Eliminacja cichych placeholderów w klientach Supabase (`client.ts`, `server.ts`, `admin.ts`, `middleware.ts`) — rzucanie jawnego wyjątku, gdy brak zmiennych środowiskowych.
5. Implementacja in-memory sliding window rate limitera (`apps/web/src/lib/rate-limiter.ts`) i zabezpieczenie nim tras: `/api/voice/transcribe`, `/api/family/invite`, `/api/family/register`, `/api/polar/sync`.
6. Usunięcie zbędnych plików tymczasowych `test-invite*.js` z roota oraz `apps/web/pnpm-lock.yaml`.

## Kryteria akceptacji
- AC1: Nieautoryzowane zapytania do chronionych tras `/api/*` (np. `/api/residents`, `/api/polar/sync`) są blokowane przez middleware lub zwracają 401/403.
- AC2: Hasła tymczasowe generowane są za pomocą bezpiecznego PRNG `crypto.randomBytes`, spełniając wymogi złożoności.
- AC3: Usunięcie pensjonariusza przez `deleteResidentAction` rejestruje wpis `RESIDENT_DELETED` w `audit_logs`.
- AC4: Przekroczenie limitu zapytań na endpointach objętych rate limitingiem zwraca HTTP 429 Too Many Requests z nagłówkiem `Retry-After`.
- AC5: Wszystkie testy przechodzą i bramka `bash scripts/verify.sh --full` jest zielona.
