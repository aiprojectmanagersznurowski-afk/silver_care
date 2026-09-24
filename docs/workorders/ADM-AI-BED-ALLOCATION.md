# Work Order: ADM-AI-BED-ALLOCATION

## Wymagania
Rejestr: ADM-BED-ASSIGNMENT, ADM-FACILITY-MANAGE, ADM-FACILITY-OCCUPANCY

## Opis
Inteligentny moduł optymalizacji i rekomendacji alokacji łóżek w placówce:
1. `apps/web/src/lib/bed-allocation-optimizer.ts`:
   - Ewaluacja bieżącego stanu obłożenia placówki pod kątem reguł jakości:
     - Zgodność płciowa: w pokojach wieloosobowych bezwzględny priorytet zachowania jednolitości płci (kara za konflikt płciowy).
     - Zgodność mobilności / opieki: mieszkańcy leżący (`bedridden`) lub objęci opieką hospicyjną (`hospice`) powinni znajdować się na parterze (floor: 0 / Parter) w celu szybkiej ewakuacji i łatwego dostępu personelu.
     - Kryterium ZSN: pensjonariusze objęci Zwiększonym Skupieniem Nadzoru są grupowani w pokojach łatwo dostępnych.
   - Algorytm rekomendacji relokacji (przeniesień):
     - Wyszukiwanie optymalnych przesunięć do wolnych łóżek lub zamian minimalizujących konflikty.
     - Obliczanie wskaźnika dopasowania (score 0-100%) przed i po optymalizacji.
   - Pseudonimizacja danych:
     - Do logiki optymalizacji i ewentualnego promptu LLM przekazywane są wyłącznie identyfikatory techniczne UUID oraz inicjały (np. "J. K.") wraz z parametrami niefizjologicznymi (płeć, poziom mobilności, piętro).
     - Brak jakichkolwiek numerów PESEL czy wrażliwych danych osobowych.
2. `apps/web/src/actions/bed-allocation.ts`:
   - `analyzeBedAllocationAction`: Pobiera aktywne pokoje, łóżka i przypisania w ramach bieżącej placówki (`organization_id`), z pełną izolacją multi-tenant, wylicza analizę i zwraca listę propozycji relokacji.
   - `executeBedRelocationAction`: Atomowe wykonanie zaakceptowanych przeniesień z użyciem procedury bazodanowej `transfer_resident_bed(p_resident_id, p_new_bed_id)`, zachowującej historię przypisań (`unassigned_at`) oraz rejestracja zdarzenia `RESIDENTS_BED_ALLOCATION_OPTIMIZED` w `audit_logs`.
3. `apps/web/src/components/facility/BedAllocationOptimizerDialog.tsx`:
   - Interaktywny modal w `/admin/facility` prezentujący:
     - Aktualny wskaźnik zgodności placówki (pasek postępu, liczba konfliktów).
     - Listę sugerowanych przeniesień z uzasadnieniem (np. "Przeniesienie na parter ze względu na ograniczoną mobilność", "Rozwiązanie konfliktu płci w pokoju 102").
     - Możliwość selektywnego lub masowego zatwierdzenia relokacji.
4. Testy:
   - `tests/logic/bed_allocation_optimizer.test.ts` weryfikujące reguły punktacji, wykrywanie konfliktów, determinizm algorytmu i pseudonimizację danych ze znacznikiem `@REQ: ADM-BED-ASSIGNMENT`.

## Kryteria akceptacji
- AC1: Algorytm bezbłędnie wykrywa konflikty płci w pokojach wieloosobowych oraz lokowanie pensjonariuszy leżących na piętrach > 0.
- AC2: W danych przekazywanych do analizy nie występują pełne dane osobowe ani PESEL (stosowane są wyłącznie inicjały i UUID).
- AC3: Przeniesienie pensjonariusza wykonuje się atomowo (`transfer_resident_bed`), poprawnie zamykając poprzednie przypisanie (`unassigned_at = now()`) i rejestrując audit log `RESIDENTS_BED_ALLOCATION_OPTIMIZED`.
- AC4: Wszystkie zapytania są ściśle filtrowane po `organization_id` bieżącego administratora.
