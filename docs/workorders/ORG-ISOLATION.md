# Work Order: ORG-ISOLATION

## Kontekst wymagania
- **ID:** ORG-ISOLATION
- **Cel:** Każda placówka ma własny `organization_id`, a wszystkie polityki RLS (Row Level Security) w bazie Supabase izolują do niego dane.
- **Ryzyko:** HIGH
- **Kryteria Akceptacji:**
  1. Zapytanie konta z placówki A nie zwraca żadnego wiersza placówki B.
  2. Izolacja działa na poziomie bazy, nie aplikacji — test wykonuje surowe zapytanie SQL z tokenem obcej placówki.
  3. Nowy rekord dziedziczy `organization_id` z tokenu, a nie z ciała żądania (z payloadu).

## Plan Implementacji (Etap: RED -> GREEN)

1. **Inicjalizacja bazy Supabase**
   - Jeśli to pierwsza migracja, inicjalizacja projektu Supabase (`supabase init` lub utworzenie schematu).
   - Migracja tworząca tabelę `organizations`.

2. **Funkcje bazodanowe dla RLS (PostgreSQL)**
   - Stworzenie funkcji w Postgres do pobierania `organization_id` bezpośrednio z tokenu JWT:
     `current_setting('request.jwt.claims', true)::json->'app_metadata'->>'organization_id'`.
   - Zapewnienie, że nowe rekordy domyślnie używają tej funkcji jako wartości w kolumnie `organization_id` (np. przez `DEFAULT get_jwt_organization_id()`).

3. **Polityki bezpieczeństwa (Row Level Security)**
   - Włączenie RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) dla wszystkich przyszłych tabel związanych z placówką.
   - Zdefiniowanie ogólnych polityk odczytu i zapisu gwarantujących, że wiersze widzi i może edytować tylko osoba z właściwym `organization_id` w tokenie.

4. **Testy jednostkowe (Etap VERIFY)**
   - Napisanie testu w Vitest (lub z użyciem klienta Postgres), który symuluje logowanie użytkownika A i próbę dostępu do wiersza utworzonego przez użytkownika B.
   - Weryfikacja, że zapytanie ominięciem warstwy aplikacyjnej odrzuca próbę (na poziomie bazy).

## Decyzje architektoniczne
- **Środowisko testowe:** Testy RLS będą wykonywane na produkcji w chmurze Supabase, nie wymagamy lokalnego instancjonowania bazy w CI. W środowisku zdalnym połączymy się przez Connection String.
