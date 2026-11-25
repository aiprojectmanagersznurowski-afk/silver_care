# Odbiór pilotażu dwóch placówek

Baza poprawek to `origin/codex/nowe-zmiany` na `2345e1b4`, w zakresie PR #313. Gałąź robocza `fix/pilot-readiness`. Każdy punkt ma osobny test regresji i dowód odbioru.

| Kolejność | Pakiet | Kryterium odbioru | Stan |
|---|---|---|---|
| 1 | Utrata nagrań i bramka push | Polecenie w zdaniu przedstawienia pozostaje w materiale. Push automatyczny ma jeden jawny cel i refspec. | Gotowe lokalnie. Commit `ca08368b`, 10/10 testów celowanych. |
| 2 | Wdrożenie i MFA | Błąd publikacji kandydata blokuje migracje stagingu. Alias przechodzi na nową aplikację po migracjach. Publikację uruchamia osoba z uprawnieniami w Vercelu. | Workflow gotowy do próby w uprawnionym środowisku. |
| 3 | Nagrania webowe i retencja | Odrzucenie techniczne zostawia możliwość ponowienia. Retencja obejmuje audio po niepełnym zapisie, szkice i raporty operacyjne. | Do wykonania |
| 4 | Izolacja i publikacja | Storage respektuje placówkę i zakres roli. Podgląd importu oraz transkrypcja sprawdzają role. Publikacja egzekwuje indywidualny przegląd oznaczonego szkicu. | Do wykonania |
| 5 | Zgody i dostęp rodzin | Polityki sprawdzają cel i stan zgody. Cofnięcie natychmiast odcina odpowiednie operacje. Zgodność migracji starszych zgód wymaga decyzji biznesowej, jeśli brakuje udokumentowanej podstawy. | Do wykonania |
| 6 | Setup i czas pracy | Oba układy arkusza, pokoje, osoby, przypisania i bezpieczne ponowienie importu w dwóch pustych placówkach. Po dwie opiekunki na zmianę. Pomiar wszystkich minut personelu i kierownika, także korekt i podwójnych wpisów. | Do wykonania |
| 7 | Urządzenia, środowisko i zgodność | Test urządzenia z odbiorem, retransmisją oraz wykazem wysyłek. Domknięcie #307 i #306, dowód retencji, dostawców, DPIA, szkolenia AI i wymaganej przejrzystości. | Zależności zewnętrzne |

## Wznowienie

Otwórz worktree gałęzi `fix/pilot-readiness`, sprawdź `git status --short --branch` i zacznij od pierwszego wiersza w stanie „W toku” lub „Do wykonania”. Po każdym pakiecie dopisz wynik, test i commit. Używaj izolowanego Supabase i danych syntetycznych. Publikacja na Vercelu wymaga uprawnionego operatora. Zakres plików sprzętowych jest w #307, a dwa zanonimizowane układy eksportów są potrzebne do odbioru importu. Zmiany treści kontraktu mają osobne okno otwierane przez człowieka.
