# Work Order: ADM-FACILITY-OCCUPANCY

## Metadane
- **Wymaganie:** `ADM-FACILITY-OCCUPANCY` (Widok obłożenia placówki)
- **Domena:** facility
- **Ryzyko:** MEDIUM
- **Zależności:** `ADM-FACILITY-MANAGE`, `ADM-BED-ASSIGNMENT`

## Cel
Dostarczenie administratorowi placówki natychmiastowego dostępu do informacji o obłożeniu pokoi. Widok musi odzwierciedlać rzeczywisty stan bez opóźnień (brak cache) i nie może wymagać ręcznego przeliczania przez użytkownika ani skomplikowanych skryptów synchronizujących.

## Kryteria Akceptacji (z kontraktu)
1. Liczba wolnych łóżek wyliczana z aktywnych przypisań, nie przechowywana osobno.
2. Widok aktualizuje się natychmiast po zmianie przypisania — nie ma opóźnienia ani cache do odświeżenia ręcznie.

## Plan Realizacji (Baza Danych - PostgreSQL / Supabase)

### 1. Rozszerzenie logiki `rooms` o Computed Columns
W poprzednich zadaniach (`ADM-FACILITY-MANAGE`) wdrożyliśmy Computed Column (funkcję bazy danych STABLE) `bed_count`, zwracającą całkowitą liczbę aktywnych łóżek dla pokoju. Zgodnie z tym samym, elastycznym wzorcem dodamy kolejne funkcje na tabeli `rooms`:
- `occupied_beds(rooms)`: Wylicza łóżka, które posiadają obecnie aktywne przypisanie (`unassigned_at IS NULL`).
- `free_beds(rooms)`: Wylicza liczbę całkowicie wolnych łóżek, kalkulowaną jako `bed_count(rooms) - occupied_beds(rooms)`.

### 2. Utworzenie widoku placówki (View) lub w pełni poleganie na PostgREST
Dzięki PostgREST używanemu w Supabase, front-end może zapytania formułować bezpośrednio do tabeli i odpytywać funkcje pochodne tak, jakby były kolumnami (np. `SELECT id, name, bed_count, occupied_beds, free_beds FROM rooms`). Nie potrzebujemy w tym celu materializowanych widoków, a same computed columns w 100% zaspokajają kryteria:
- Są wyliczane w locie (ad-hoc), co daje natychmiastową aktualizację (KA 2).
- Nigdy nie mogą wejść w asynchronię / out-of-sync (KA 1).

### 3. Testy Jednostkowe (Vitest)
Dodanie pliku `tests/db/occupancy.test.ts`:
- Tworzy pokój i dwa łóżka (bed_count = 2, occupied_beds = 0, free_beds = 2).
- Przypisuje pacjenta (bed_count = 2, occupied_beds = 1, free_beds = 1).
- Przenosi pacjenta na drugie łóżko (wynik taki sam).
- Dezaktywuje jedno wolne łóżko (bed_count = 1, occupied_beds = 1, free_beds = 0).

## Otwarte Pytania / WYMAGA DECYZJI
- Brak otwartych pytań architektonicznych, bazujemy na wzorcu wprowadzonym w fazie `ADM-FACILITY-MANAGE`. Computed functions STABLE podpinane pod PostgREST są zoptymalizowane pod takie odczyty dla MVP.
