# Work Order: NUR-CLICK-REDUCTION

## Wymaganie
Rejestr: NUR-15 (Optymalizacja i automatyzacja codziennych ścieżek personelu — Click-Reduction Engine)

## Opis
Moduł automatyzacji i redukcji czasu pracy personelu opiekuńczego:
1. Masowe zatwierdzanie raportów dziennych (do 10 jednocześnie) z poziomu widoku weryfikacji raportów personelu (/staff/reports) za pomocą Server Action `bulkPublishReportsAction`.
2. Globalna paleta poleceń Command Palette (Cmd+K / Ctrl+K) umożliwiająca błyskawiczne wyszukiwanie pensjonariusza i przejście do dyktowania notatki w czasie < 2 sekund.
3. Tryb szybkiego obchodu dyżuru (Quick-Rounds Mode) w tablicy dyżuru personelu (/staff): duże kafelki dostosowane do urządzeń mobilnych z bezpośrednim przejściem do notatki oraz rejestracją rutynowej obserwacji stabilnego stanu (skrócenie ścieżki z 7 do 2 kliknięć).

## Kryteria akceptacji
- AC1: Możliwość jednoczesnego zatwierdzenia do 10 raportów dziennych jednym kliknięciem (masowa publikacja dla rodzin).
- AC2: Globalna paleta Cmd+K / Ctrl+K filtruje podopiecznych i otwiera dyktowanie w czasie < 2 sekund.
- AC3: Ścieżka rejestracji notatki skrócona z 7 do 2 kliknięć w trybie obchodu dyżuru (Quick-Rounds).
