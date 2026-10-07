# Work Order: UI-NUR-AGENDA-TOAST

## Cel
Podpięcie kanonicznych powiadomień toast (biblioteka Sonner) w module Planera Dnia Personelu (`/staff/agenda`) i usunięcie zastępczego obiektu `console.log`.

## Wymagania
- Import `toast` bezpośrednio z biblioteki `sonner`.
- Wyświetlanie powiadomień toast w handlerach:
  - Sukces dodania: *"Wydarzenie zostało dodane do harmonogramu."*
  - Sukces aktualizacji: *"Zaktualizowano wpis w harmonogramie."*
  - Sukces usunięcia: *"Usunięto wpis z harmonogramu."*
  - Błędy sieci / zapytania: czytelne komunikaty `toast.error(...)`.
- Usunięcie atrapy `const toast = { success: ..., error: ... }`.

## Testy
- `tests/logic/ui_nur_agenda_toast.test.ts` weryfikujący podpięcie Sonner i brak konsolowej atrapy.
