# Work Order: ADM-BULK-IMPORT

## Wymaganie
Rejestr: ADM-07 (Masowy import pensjonariuszy z pliku Excel/CSV z walidacją i preview)

## Opis
Moduł dwuetapowego importu pensjonariuszy:
1. Dry-run: Parsowanie pliku .xlsx lub .csv, walidacja formatu, identyfikatora PESEL, wyliczenie wieku i płci, wykrycie duplikatów w pliku oraz w placówce.
2. Podgląd (Preview): Prezentacja tabelaryczna wierszy poprawnych i błędnych z dokładnym opisem problemów.
3. Import: Transakcyjny zapis w chunkach tylko poprawnych wierszy do tabeli `residents`, haszowanie `pesel_hash`, szyfrowanie `pesel_encrypted`, wpis do `audit_logs` z liczbą rekordów.
4. Możliwość pobrania szablonu XLSX/CSV z poziomu panelu.

## Kryteria akceptacji
- AC1: Pobieranie wzorcowego szablonu importu (.xlsx / .csv).
- AC2: Podgląd i walidacja z raportem błędnych rekordów (np. błędna suma kontrolna PESEL, duplikaty).
- AC3: Możliwość importu poprawnych rekordów z pominięciem błędnych.
- AC4: Zapis w bazie danych z uwzględnieniem `organization_id`, `pesel_hash`, `pesel_encrypted` i logu audytowego.
