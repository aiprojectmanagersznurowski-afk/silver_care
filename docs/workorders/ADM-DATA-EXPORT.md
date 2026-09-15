# Work Order: ADM-DATA-EXPORT

## Wymaganie
Rejestr: ADM-08 (Bezpieczny eksport danych placówki i listy podopiecznych - CSV/XLSX/PDF)

## Opis
Moduł bezpiecznego generowania i pobierania zestawień operacyjnych placówki:
1. Filtry zakresu: aktywni / zarchiwizowani / wszyscy, tylko z pakietem ZSN.
2. Formaty:
   - XLSX (arkusz z formatowaniem kolumn)
   - CSV (kodowanie UTF-8 z BOM \uFEFF dla bezproblemowego otwierania w Excelu)
   - JSON / PDF (dane operacyjne i stan obłożenia)
3. Zgodność z MDR i RODO:
   - Brak jakichkolwiek surowych danych fizjologicznych (tętno, HRV, wyniki medyczne)
   - Identyfikator PESEL maskowany domyślnie (np. `440514*****`)
   - Rejestracja zdarzenia w `audit_logs` (`RESIDENTS_DATA_EXPORT`) z identyfikatorem użytkownika, zakresem filtrów i liczbą wyeksportowanych wierszy.
4. UI: Dialog eksportu zintegrowany w `/admin/residents`.

## Kryteria akceptacji
- AC1: Interfejs wyboru filtrów i formatu eksportu na `/admin/residents`.
- AC2: Poprawne formatowanie i obsługa polskich znaków UTF-8 z BOM w CSV i XLSX.
- AC3: Zapis każdego wygenerowania eksportu w `audit_logs`.
- AC4: Zgodność z zasadami MDR i brak wycieku wrażliwych danych.
