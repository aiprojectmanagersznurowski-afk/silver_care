# Silver Care — Work Orders (Karty Pracy)

## Status i Przeznaczenie Katalogu

Wszystkie historyczne, zrealizowane karty prac (Work Orders) zostały przeniesione do katalogu archiwalnego:
📁 [`docs/workorders/archive/`](./archive/)

### Hierarchia Źródeł Prawdy

1. **Nadrzędne Źródło Prawdy:**
   - Jedynym nadrzędnym źródłem prawdy dla struktur danych, uprawnień RLS, reguł walidacji, tokenów UI i identyfikatorów wymagań są kontrakty w **`contracts/*.contract.mjs`** (oraz generowane z nich moduły `@silvercare/contracts`).
2. **Warstwa Narracyjna User Stories:**
   - Kontekst biznesowy, opisy ról i scenariusze użytkowników opisane są w **`docs/KANONICZNA_SPECYFIKACJA_USER_STORIES.md`** (w przypadku jakiejkolwiek sprzeczności z kontraktem — wygrywa kontrakt).
3. **Zarządzanie Zadaniami:**
   - Nowe zadania są pobierane i rozliczane bezpośrednio na tablicy **Trello Backlog** (zgodnie z filtrowaniem przypisania do programisty).
   - Nowe dokumenty Work Order (`WO-<REQ-ID>.md`) są tworzone wyłącznie w sytuacjach, gdy zadanie wymaga sformalizowanego, wieloetapowego planowania architektonicznego przed otwarciem okna kontraktowego.
