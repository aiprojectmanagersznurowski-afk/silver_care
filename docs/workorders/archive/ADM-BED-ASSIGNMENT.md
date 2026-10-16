# Work Order: ADM-BED-ASSIGNMENT

## Metadane
- **Wymaganie:** `ADM-BED-ASSIGNMENT` (Zarządzanie przypisaniami łóżek dla pensjonariuszy)
- **Domena:** facility / residents
- **Ryzyko:** HIGH
- **Zależności:** `ADM-RESIDENT-ADD`, `ADM-FACILITY-MANAGE`

## Cel
Zapewnienie integralności danych podczas przypisywania pensjonariuszy do łóżek. System musi gwarantować, że łóżko może być zajęte przez maksymalnie jedną osobę, a jedna osoba może posiadać najwyżej jedno aktywne przypisanie do łóżka. Dodatkowo operacje transferu (zmiany łóżka) muszą być atomowe.

## Kryteria Akceptacji
1. Przypisanie do łóżka z aktywnym przypisaniem innej osoby jest odrzucane na poziomie bazy.
2. Jeden pensjonariusz może posiadać w danej chwili najwyżej jedno aktywne przypisanie (aktywne = `unassigned_at IS NULL`).
3. Przeniesienie pensjonariusza to jedna operacja zamykająca stare przypisanie i otwierająca nowe w tej samej transakcji.
4. Historia przypisań jest zachowana — zamknięte przypisanie ma uzupełnione `unassigned_at`, rekord nie jest usuwany.
5. Zarchiwizowany pensjonariusz (`archived_at IS NOT NULL`) nie może zostać przypisany do żadnego łóżka.

## Plan Realizacji (Baza Danych - PostgreSQL / Supabase)

### 1. Zapobieganie podwójnym przypisaniom (Unique Indexes)
- W poprzedniej migracji utworzyliśmy index zabezpieczający łóżko: `CREATE UNIQUE INDEX active_bed_assignment_idx ON public.bed_assignments (bed_id) WHERE unassigned_at IS NULL;`
- Teraz dodajemy index zabezpieczający pensjonariusza: `CREATE UNIQUE INDEX active_resident_assignment_idx ON public.bed_assignments (resident_id) WHERE unassigned_at IS NULL;`

### 2. Zapobieganie przypisaniom zarchiwizowanych pensjonariuszy (Trigger)
- Wymagane jest sprawdzenie krzyżowe z tabelą `residents`.
- Najbezpieczniejszym podejściem jest utworzenie triggera bazy danych dla tabeli `bed_assignments` (`BEFORE INSERT OR UPDATE`), który zweryfikuje czy pensjonariusz posiada `archived_at IS NOT NULL`. Jeżeli tak, trigger rzuci wyjątek blokując przypisanie.

### 3. Operacja przeniesienia (RPC - funkcja bazy)
- Ponieważ przeniesienie musi być atomowe (zamknięcie starego i otwarcie nowego przypisania), a w Supabase preferujemy trzymanie logiki integralności po stronie bazy, utworzymy funkcję (RPC) `public.transfer_resident_bed(p_resident_id uuid, p_new_bed_id uuid)`.
- Funkcja wykona: 
  1. `UPDATE bed_assignments SET unassigned_at = now() WHERE resident_id = p_resident_id AND unassigned_at IS NULL;`
  2. `INSERT INTO bed_assignments (bed_id, resident_id) VALUES (p_new_bed_id, p_resident_id);`
- Zapewni to, że operacja zamyka się w 1 transakcji bazy bez ryzyka race conditions w klientach.

### 4. Testy Jednostkowe (Vitest)
Utworzenie/rozszerzenie pliku `tests/db/bed_assignments.test.ts` (lub odpowiednich bloków):
- Sprawdzenie, czy aktywny pensjonariusz nie może posiadać dwóch przypisanych łóżek (łapanie duplikatu z indeksu).
- Sprawdzenie zablokowania przypisania zarchiwizowanego pensjonariusza (łapanie wyjątku z triggera).
- Test integracyjny RPC `transfer_resident_bed`, udowadniający, że po zmianie zachowana jest historia (poprzednie przypisanie otrzymuje `unassigned_at`).

## Otwarte Pytania / WYMAGA DECYZJI
- **WYMAGA DECYZJI:** Podejście do przenoszenia pensjonariuszy. Czy implementować w logice aplikacyjnej (np. edge functions) z dwoma wywołaniami bazy otoczonymi przez blokadę optymistyczną, czy też na poziomie funkcji RPC w PostgreSQL? Pod MVP **rekomenduję użycie RPC wbudowanego w bazę**. Zapewni to 100% atomowość operacji bezpośrednio przez RLS dla roli `org_admin`.
