# Work Order: FAM-AGENDA

## Metadane
- **Wymaganie:** `FAM-AGENDA` (Bliski widzi plan dnia pensjonariusza)
- **Domena:** family
- **Ryzyko:** MEDIUM
- **Zależności:** `NUR-AGENDA` (zalecane do wcześniejszej realizacji po stronie bazy/API, chociaż struktura bazy może być współdzielona)

## Cel
Umożliwienie osobom bliskim (rodzinom) wglądu w plan dnia przypisanego im pensjonariusza. Zgodnie ze specyfikacją system musi poprawnie łączyć pozycje indywidualne dla danego podopiecznego z ogólnymi punktami w agendzie placówki (np. wspólne posiłki), pokazując je na jednym widoku chronologicznie.

## Kryteria Akceptacji
1. Widok łączy pozycje indywidualne i wspólne dla placówki na jeden, spójny plan dnia.
2. Dostęp ograniczony jest ściśle do pensjonariuszy, z którymi zalogowana osoba bliska posiada aktywne powiązanie w tabeli relacji.
3. W przypadku braku planu system wyświetla dedykowany i czytelny stan pusty (zgodnie z `UI-FOUR-STATES`).

## Plan Realizacji

### 1. Baza Danych (Potencjalna aktualizacja RLS / Widoku)
W migracji `20260901143000_family_module_features.sql` dodano już bazową tabelę `agenda_items`. 
- Upewnimy się, że polityka RLS pozwala roli `family` na dostęp do:
  a) elementów z `resident_id IS NULL` (wspólne pozycje) w obrębie placówki.
  b) elementów przypisanych bezpośrednio do powiązanego podopiecznego `resident_id = ...`.
- Należy stworzyć odpowiednie Security Definer RPC lub zaktualizować politykę na tabeli, by bliscy mogli pobrać tylko właściwe rekordy (aktualna w migracji pozwala na czysty SELECT dla całej placówki po `organization_id` – wymaga doprecyzowania, żeby uniknąć wycieku agendy *innych* seniorów z placówki).

### 2. Frontend: API (Next.js) & Hook
- Stworzenie bezpiecznego endpointu API (np. `GET /api/residents/[id]/agenda`), który:
  - Waliduje czy dany użytkownik (rodzina) ma uprawnienia do `[id]` podopiecznego.
  - Pobiera pozycje wspólne i prywatne z tabeli `agenda_items`, a następnie je zwraca, sortując chronologicznie.
- Napisanie lub aktualizacja hooka w aplikacji (np. `useAgenda`).

### 3. Frontend: Widok Komponentu
- Stworzenie wizualnej osi czasu (Timeline) dla agendy seniora (godzina, ikona aktywności, nazwa aktywności).
- Zapewnienie stanów pobierania (`loading`), błędu (`error`) oraz dedykowanego widoku w przypadku braku aktywności w danym dniu (`empty`).

### 4. Testy (Vitest)
- Test bazodanowy (jeśli aktualizujemy RLS) weryfikujący, że rodzina A nie widzi pozycji indywidualnych z agendy dla seniora B.
- Test jednostkowy dla komponentu (lub przynajmniej dla wyliczania agendy), aby potwierdzić prawidłowe połączenie pozycji wspólnych (bez `resident_id`) z pozycjami indywidualnymi.

## Otwarte Pytania / WYMAGA DECYZJI
- **WYMAGA DECYZJI:** Tabela `agenda_items` w obecnym formacie ma politykę RLS "agenda_items_isolation" na całe `organization_id`. Dla roli `family` doprowadzi to do możliwości odczytania planów wszystkich pensjonariuszy z tej samej placówki. Musimy zacieśnić RLS dla roli `family` (wymaga powiązania z podopiecznym). Proponuję napisać dodatkową migrację zawężającą dostęp dla ról nienależących do personelu. Czy zatwierdzasz stworzenie nowej migracji zaostrzającej RLS na `agenda_items` dla rodzin?
