# Work Order: Kontrolowany Podgląd PESEL ze Step-Up Authentication i Audytem (SEC-PESEL-STEP-UP)

## Wymaganie
Uprawniony pracownik personelu medycznego (`nurse`, `org_admin`) potrzebuje jednorazowo odsłonić numer PESEL podopiecznego (np. dla NFZ/recepty/karty medycznej):
1. PESEL jest domyślnie zamaskowany w interfejsie (`850401•••••`).
2. Odsłonięcie wymaga Step-Up Authentication: podania hasła pracownika oraz wskazania powodu wglądu.
3. Błędne hasło natychmiast blokuje odsłonięcie i loguje `AUTH_FAILURE`.
4. Poprawne hasło odsłania numer na maksymalnie 30 sekund (Transient Reveal w pamięci stanu, bez zapisu w Storage przeglądarki).
5. Każda próba (udana i nieudana) jest rejestrowana w `audit_logs` i `security_access_logs` z powodem i ID podopiecznego — BEZ jawnego numeru PESEL w payloadzie.

Wymagania powiązane w kontrakcie:
- `SEC-PESEL-HASH`: Zachowanie bezpiecznego hashowania do wyszukiwania duplikatów i zakaz kolumny z jawnym tekstem PESEL.
- `SEC-NO-PII-LOGS`: Bezwzględny brak numeru PESEL w logach audytowych i systemowych.
- `SEC-403-LOGGING`: Rejestracja nieautoryzowanych prób dostępu.
- `UI-FOUR-STATES`: Bezpieczny interfejs odsłaniania ze stanem załadowania, błędu i odliczania czasu.

## Cele
1. Utworzyć migrację `supabase/migrations/20260915150000_pesel_encrypted_step_up.sql` z kolumną `pesel_encrypted` i procedurą `public.log_pesel_access_attempt`.
2. Zaimplementować moduł kryptograficzny `apps/web/src/lib/pesel-crypto.ts` (AES-256-GCM).
3. Zaimplementować Server Action `apps/web/src/actions/pesel.ts`.
4. Zaimplementować komponent UI `apps/web/src/components/PeselReveal.tsx`.
5. Napisać testy `tests/logic/pesel_reveal.test.ts` oraz `tests/db/pesel_step_up.test.ts`.
6. Zweryfikować bramką `bash scripts/verify.sh --full`.
