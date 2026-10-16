# Work Order: UI-GRANULAR-EDITING

## Wymaganie
Rejestr: UI-14 (Granularna edycja wszystkich potrzebnych elementów w UI — Inline & Sheet Editing)

## Opis
Moduł szybkiej edycji pensjonariusza:
1. Edycja w miejscu (Inline Editing) dla kluczowych atrybutów: poziom opieki care_level, ZSN, notatka / uwagi.
2. Wysuwany arkusz boczny (Sheet / Drawer) umożliwiający szybką edycję profilu podopiecznego (imię, nazwisko, data urodzenia, data przyjęcia, uwagi) bezpośrednio z listy bez opuszczania tabeli.
3. Optymistyczne aktualizacje UI (optymistyczny stan) z automatycznym rollbackiem i komunikatem błędu.
4. Sprawdzanie uprawnień wg macierzy ról MATRIX (edycja pensjonariusza dozwolona dla org_admin oraz personelu uprawnionego).
5. Pełna rejestracja każdej modyfikacji w audit_logs ze wskazaniem zmienionych pól, bez wycieku danych wrażliwych.

## Kryteria akceptacji
- AC1: Kliknięcie kontrolki/arkusza otwiera edycję w miejscu lub boczny Sheet bez przeładowania podstrony.
- AC2: Błąd sieci/zapisu natychmiast przywraca poprzednią wartość (rollback optymistyczny) i wyświetla komunikat o błędzie.
- AC3: Każda edycja rejestruje zmienione pola w audit_logs oraz weryfikuje uprawnienia wg MATRIX (residents:update).
