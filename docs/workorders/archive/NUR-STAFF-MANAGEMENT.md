# Work Order: Zarządzanie Kontami Personelu przez Admina Placówki (NUR-STAFF-MANAGEMENT)

## Wymaganie
Administrator Placówki (`org_admin`) w panelu personelu (`/admin/staff`) posiada bezpieczną kontrolę nad kontami personelu swojej placówki:
1. Reset hasła (wysłanie linku lub hasło tymczasowe z wymogiem zmiany `must_change_password`).
2. Odwracalne zawieszenie / przywrócenie konta (ban na 10 lat z potwierdzeniem wpisania `DEZAKTYWUJ`).
3. Multi-tenant Guard: blokada operacji na użytkownikach z innej placówki (403 Forbidden).
4. Rejestracja w `audit_logs` każdej akcji (`staff_password_reset`, `staff_suspended`, `staff_restored`) bez PII.

Wymagania powiązane w kontrakcie:
- `ORG-ISOLATION`: Ochrona przed modyfikacją kont personelu obcych placówek.
- `SEC-SESSION`: Natychmiastowe unieważnienie sesji przy zawieszeniu/resecie.
- `SEC-AUDIT-APPEND-ONLY`: Zapis w niezmiennym rejestrze audytowym.
- `UI-FOUR-STATES`: Bezpieczne modale i obsługa stanów UI.

## Cele
1. Utworzyć migrację `supabase/migrations/20260915140000_staff_account_management.sql` z procedurą `public.log_staff_management_action`.
2. Zaimplementować Server Actions w `apps/web/src/actions/staff-management.ts`:
   - `resetStaffPasswordAction(targetUserId, mode: 'email' | 'temp')`
   - `suspendStaffAction(targetUserId, confirmationText: string)`
   - `restoreStaffAction(targetUserId)`
3. Dodać obsługę akcji w panelu personelu `/admin/staff` z modalem wpisania `DEZAKTYWUJ`.
4. Napisać testy jednostkowe i bazodanowe (`tests/logic/staff_management.test.ts`, `tests/db/staff_management.test.ts`).
5. Zweryfikować bramką `bash scripts/verify.sh --full`.
