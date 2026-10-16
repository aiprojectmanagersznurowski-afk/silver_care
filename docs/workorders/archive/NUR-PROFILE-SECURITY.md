# Work Order: Zarządzanie Własnym Profilem i Bezpieczeństwem Konta (NUR-PROFILE-SECURITY)

## Wymaganie
Użytkownik systemu (personel, admin, bliski) posiada dedykowaną stronę `/settings/profile`, umożliwiającą:
1. Podgląd danych konta i przypisanej roli z `app_metadata.role`.
2. Bezpieczną zmianę hasła z weryfikacją bieżącego hasła i polityką siły (min 8 znaków, wielka litera, cyfra, znak specjalny).
3. Zarejestrowanie akcji zmiany hasła w `security_access_logs` i `audit_logs` (`action: password_self_change`).
4. Wylogowanie z pozostałych urządzeń via `scope: others`.
5. Podgląd stanu MFA (TOTP).

Wymagania powiązane w kontrakcie:
- `SEC-SESSION`: Kontrola sesji i unieważnianie tokenów na żądanie.
- `SEC-MFA-STAFF`: Obsługa MFA dla personelu.
- `SEC-AUDIT-APPEND-ONLY`: Zapis zdarzeń bezpieczeństwa w niezmiennym rejestrze.
- `UI-FOUR-STATES`: 4 stany komponentu UI (Loading, Empty, Success, Error).

## Cele
1. Utworzyć migrację `supabase/migrations/20260915130000_self_service_security.sql`.
2. Utworzyć Server Actions w `apps/web/src/actions/profile.ts`.
3. Utworzyć stronę `/settings/profile/page.tsx` w `apps/web/src/app/(settings)/settings/profile/page.tsx` lub `apps/web/src/app/settings/profile/page.tsx`.
4. Napisać testy jednostkowe i bazodanowe (`tests/logic/profile_security.test.ts`, `tests/db/profile_security.test.ts`).
5. Zweryfikować bramką `bash scripts/verify.sh --full`.
