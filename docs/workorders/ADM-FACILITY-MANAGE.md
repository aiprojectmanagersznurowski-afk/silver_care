# Work Order: ADM-FACILITY-MANAGE

## Metadane
- **Wymaganie:** `ADM-FACILITY-MANAGE` (Administrator zarządza rejestrem pokoi i łóżek placówki)
- **Domena:** facility
- **Ryzyko:** MEDIUM
- **Zależności:** `ORG-ISOLATION`, `ADM-RESIDENT-ADD` (tabele `rooms`, `beds`, `bed_assignments` są już częściowo wdrożone)

## Cel
Wprowadzenie mechanizmów zarządzania pokojami i łóżkami w placówce, zapewniających spójność danych i poprawność biznesową (unikalność nazw, statusy aktywności, zablokowanie możliwości usunięcia lub dezaktywacji łóżka, gdy jest w użyciu).

## Kryteria Akceptacji (z kontraktu)
1. Dodanie, edycja i dezaktywacja pokoju nie usuwa historii przypisań (używamy `deactivated_at` zamiast kasowania rekordu).
2. Numer/nazwa pokoju unikalna w obrębie placówki — próba duplikatu odrzucana przez bazę (constraint).
3. Etykieta łóżka unikalna w obrębie pokoju, nie globalnie.
4. Dezaktywacja łóżka z aktywnym przypisaniem jest odrzucana — trzeba najpierw zamknąć przypisanie.
5. `bed_count` na pokoju jest polem pochodnym, nie edytowanym ręcznie (np. poprzez trigger lub funkcję agregującą bazy danych `STABLE`).

## Plan Realizacji (Baza Danych - PostgreSQL / Supabase)

### 1. Rozbudowa tabeli `rooms`
- Dodanie kolumny `deactivated_at timestamptz`.
- Zmiana/Dodanie constraintu `UNIQUE(organization_id, name)` (lub `room_number`), by nazwa pokoju była unikalna w placówce.
- Stworzenie funkcji pochodnej (Computed Column) `bed_count(rooms) RETURNS int` lub użycie triggera, który aktualizuje ukryte pole w `rooms`, aby spełnić wymóg "nie edytowanym ręcznie". Zdecydowanie lepsza jest tu funkcja pochodna w Supabase/PostgreSQL.

### 2. Rozbudowa tabeli `beds`
- Dodanie kolumny `deactivated_at timestamptz`.
- Dodanie constraintu `UNIQUE(room_id, label)` chroniącego przed takimi samymi etykietami w jednym pokoju.
- Utworzenie triggera bazy danych (funkcji `BEFORE UPDATE`), który przy ustawianiu `deactivated_at IS NOT NULL` na łóżku weryfikuje czy łóżko to nie posiada aktywnych przypisań w tabeli `bed_assignments` (czyli takich, gdzie `unassigned_at IS NULL`). Jeśli tak - zwraca wyjątek blokujący operację.

### 3. Poziom bezpieczeństwa RLS
- Dodanie ról/polis dla updatów i edycji na tabelach `rooms` i `beds` (tylko administrator placówki: `org_admin` oraz `super_admin`).
- Polityki `SELECT` odfiltrowujące zdezaktywowane pokoje/łóżka lub zostawiające je widoczne z flagą (zależy od podejścia, bezpiecznie jest je zostawić widoczne dla widoków archiwalnych).

### 4. Testy Jednostkowe (Vitest)
Utworzenie/rozszerzenie pliku `tests/db/facility.test.ts`:
- Sprawdzenie unikalności nazwy pokoju w danej organizacji (i czy przepuści takie same nazwy w dwóch RÓŻNYCH organizacjach).
- Sprawdzenie unikalności łóżka w pokoju.
- Zablokowanie (wyjątek z triggera), gdy org_admin spróbuje ustawić `deactivated_at` na łóżku z aktywnym pacjentem.
- Sprawdzenie, czy obliczany `bed_count` jest w 100% poprawny i nie wymaga UPDATE-u ze strony klienta.

## Otwarte Pytania / WYMAGA DECYZJI
- **WYMAGA DECYZJI:** `bed_count` na pokoju: Supabase wspiera funkcje wywoływane jako computed columns (np. `SELECT rooms.name, rooms.bed_count FROM rooms`). Opcja z triggerem inkrementującym wartość kolumny w `rooms` będzie szybsza do odczytów, ale trudniejsza w utrzymaniu przy dużych migracjach. Którą ścieżkę (Computed function STABLE vs Trigger i kolumna) preferujesz pod MVP? Rekomendacja: **Computed function**, co daje zerowy nakład na spójność.
