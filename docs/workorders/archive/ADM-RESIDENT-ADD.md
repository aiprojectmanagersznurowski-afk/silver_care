# WO: ADM-RESIDENT-ADD — Tworzenie pensjonariusza, przypisanie łóżka i bliskich

## Wymaganie
Administrator dodaje pensjonariusza, przypisuje bliskich i przypisuje łóżko.
Z kontraktu: `R('ADM-RESIDENT-ADD', { source: 'SC-ADM-02, ADR-012', domain: 'residents', statement: 'Administrator dodaje pensjonariusza, przypisuje bliskich i przypisuje łóżko.', acceptance: ['PESEL zapisany wyłącznie jako hash z solą — brak wartości jawnej w bazie i w logach', 'organization_id pochodzi z tokenu administratora', 'Powiązanie zapisuje kod relacji i rolę bliskiego', 'Przyjęcie może, ale nie musi, obejmować od razu przypisanie łóżka — pensjonariusz bez przypisania jest stanem poprawnym, nie błędem', 'Próba przypisania zajętego łóżka jest odrzucana z czytelnym komunikatem, nie nadpisuje istniejącego przypisania'], risk: 'HIGH' })`

## Kontekst kodu
- Istnieje tabela `organizations` i przykładowa `rooms`. 
- Brakuje tabel rdzenia do obsługi podopiecznych: `residents` oraz powiązań `resident_relative_links`.
- Brakuje infrastruktury logistycznej `beds` i `bed_assignments`.
- Brak mechanizmu skrótów kryptograficznych (hash) dla numeru PESEL.

## Kryteria akceptacji
- **Baza nie przyjmuje numeru PESEL w postaci jawnej.** Należy zastosować w PL/pgSQL funkcję generującą sól i hashującą PESEL używając `pgcrypto` (`crypt`) przed zapisem, lub robić to w warstwie backendu. (Dla 100% pewności, `pesel` na wejściu API musi być hashowany - w bazie zapisujemy tylko wynikowy hash i sól, a jeszcze lepiej po prostu bcrypt hash).
- `residents.organization_id` przypisuje się automatycznie przez `public.get_jwt_organization_id()`.
- Tabela `resident_relative_links` łączy `residents.id` z kontami użytkowników z `auth.users` i zapisuje typ pokrewieństwa oraz formalną rolę dostępową.
- `bed_assignments` ma constraint wymuszający, by jedno łóżko miało co najwyżej jedno aktywne przypisanie (`unassigned_at IS NULL`), zapobiegając nadpisaniom na poziomie samej bazy (np. unikalny indeks z filtrem).
- Pensjonariusz może istnieć bez powiązanego wpisu w `bed_assignments`.

## Granice
- Nie budujemy interfejsu w React/Next. Skupiamy się na zaprojektowaniu tabel, relacji oraz polityk RLS w bazie, tak by były w 100% zgodne z `roles.contract.mjs` (czyli `org_admin:own` i `super_admin`).
- Zaproszenia e-mailowe (`ADM-INVITE`) to kolejne, osobne wymaganie.
- Zgody na przetwarzanie danych (`CONSENT-GRANTOR`) to kolejne wymaganie.

## Ryzyka i nieznane
- **WYMAGA DECYZJI**: Gdzie hashowany ma być PESEL? Czy zrzucamy odpowiedzialność za hashowanie na serwer (Next.js/Edge function), żeby jawny PESEL nigdy nie dotarł do warstwy bazy jako parametr logowany przez pg_stat_statements? Czy możemy go hashować w bezpiecznej funkcji PL/pgSQL, która od razu zapisze rekord i użyje `SECURITY DEFINER` bez logowania parametrów?

## Weryfikacja
- Nowy zestaw testów: `pnpm test` uruchamia testy sprawdzające brak możliwości wpisania jawnego PESEL oraz blokadę zapisu dwóch pacjentów do jednego łóżka na raz.
- Uruchomienie zielonej bramki przed commitem: `bash scripts/verify.sh --full`.
