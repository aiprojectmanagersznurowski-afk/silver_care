# Work Order: NUR-REPORT-COMPLETENESS-GATE

## Wymaganie
Rejestr: REPORT-AI-FEEDBACK, REPORT-APPROVAL, MDR-VOCABULARY

## Opis
Strażnik kompletności raportu opiekuńczego dla rodziny (AI Quality Gate):
1. Analiza 4 wymiarów troski rodziny na strumieniu behawioralnym:
   - Posiłki i apetyt (śniadanie, obiad, kolacja, płyny, apetyt)
   - Nastrój i samopoczucie (humor, uśmiech, zadowolenie, spokój)
   - Aktywność i integracja (spacer, zajęcia, rozmowa, ćwiczenia, ogród)
   - Sen i wypoczynek (noc, sen, drzemka, odpoczynek)
2. Interaktywny wskaźnik i checklista w komponencie `ReportCard` z nienarzucającymi się sugestiami (Nudge).
3. Brak blokady publikacji – personel zachowuje pełną decyzyjność i może zatwierdzić raport jednym kliknięciem mimo braków.
4. Ścisła ochrona granicy językowej: brak słownictwa klinicznego i brak słowa „pacjent” (ADR-004, ADR-005).

## Kryteria akceptacji
- AC1: Notatka bez wzmianki o posiłkach i nastroju wyświetla żółty wskaźnik brakujących informacji.
- AC2: Komunikaty asystenta nie używają słownictwa klinicznego ani słowa „pacjent”.
- AC3: Pielęgniarka może opublikować raport jednym kliknięciem niezależnie od wyniku kompletności.
