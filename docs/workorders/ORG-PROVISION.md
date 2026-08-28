# WO: ORG-PROVISION — Tworzenie placówki i jej administratora

## Wymaganie
Utworzenie placówki tworzy pierwszego org_admin i wysyła mu zaproszenie.
Z kontraktu: `R('ORG-PROVISION', { source: 'SC-SUP-03/AC3', domain: 'tenancy', statement: 'Utworzenie placówki tworzy pierwszego org_admin i wysyła mu zaproszenie.', acceptance: ['Rekord organizations powstaje wyłącznie przez super_admin', 'Konto org_admin powstaje w tej samej transakcji', 'Zaproszenie nie zawiera danych osobowych pensjonariuszy'] })`

## Kontekst kodu
- Istnieje tabela `organizations` z podstawowym RLS (z `20260828210800_org_isolation.sql`).
- Brak rozbudowanych polityk RLS ograniczających INSERT w `organizations` wyłącznie do konta o roli `super_admin` (zgodnie z macierzą uprawnień w `roles.contract.mjs`: `create: ['super_admin']`).
- Brak funkcji transakcyjnej w PL/pgSQL zdolnej do utworzenia organizacji oraz jednoczesnego wstawienia rekordu użytkownika do mechanizmu `auth.users` i nadania mu roli `org_admin`.

## Kryteria akceptacji
- Zwykły użytkownik ani `org_admin` nie może wykonać instrukcji `INSERT INTO organizations`. Operacja zostaje zablokowana przez RLS, a nie tylko ukryta na frontendzie.
- Istnieje bezpieczna funkcja RPC w bazie (np. `provision_organization(org_name, admin_email)`), z limitowanym dostępem dla `super_admin`.
- Funkcja tworzy nowy rekord w `organizations` i wykorzystuje wbudowany mechanizm `auth.users` (bądź API zarządzania) do wysłania zaproszenia na email w obrębie jednej transakcji.
- W logice zaproszenia absolutnie nie znajdują się dane pacjentów/pensjonariuszy, ani dane medyczne.

## Granice
- Nie modyfikujemy jeszcze logiki frontendu – skupiamy się wyłącznie na przygotowaniu bazy (migracja) i jej weryfikacji.
- Implementacja i konfiguracja zewnętrznego dostawcy SMS/Email pozostaje zamrożona (parked). Supabase Auth potrafi wysłać domyślny email z potwierdzeniem zaproszenia.

## Ryzyka i nieznane
- **WYMAGA DECYZJI**: W jaki sposób technicznie nadamy pierwszemu użytkownikowi w systemie status `super_admin`, który będzie mógł założyć pierwszą placówkę? Czy mamy stworzyć skrypt CLI ("bootstrap") odpalany na backendzie/localu korzystający z uprzywilejowanego klucza `service_role`, aby założyć pierwszego administratora bez omijania RLS?

## Weryfikacja
- Komenda `pnpm test` musi wykonać nowe testy (np. `tests/db/provisioning.test.ts`), które uruchomią próbę wywołania funkcji jako intruz, a następnie jako super_admin.
- Uruchomienie zielonej bramki przed commitem: `bash scripts/verify.sh --full`.
