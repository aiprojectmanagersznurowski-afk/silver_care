<!-- WYGENEROWANE z .claude/CLAUDE.md przez tools/sc-port-antigravity.mjs — nie edytuj ręcznie. -->
## Zasada pytań i obsługa sprzeczności (Koniec zasady „Zero Pytań”)

W projekcie **nie obowiązuje** zasada „zero pytań / pełna autonomia przy niejasnościach”.
Nowa reguła nadrzędna:
**W przypadku wykrycia sprzeczności między kontraktem, istniejącym kodem a poleceniem użytkownika — ZATRZYMAJ SIĘ i zadaj 1 precyzyjne pytanie weryfikujące przed zapisaniem plików.**

Decyzje techniczne mieszczące się w kontrakcie (odwracalne, bez wpływu na dane osobowe i granice prawne) realizujesz zgodnie z `DEFAULTS` z `autonomy.contract.mjs`. Jeśli jednak polecenie użytkownika lub istniejący kod koliduje z kontraktem lub granicami MDR/RODO — zadaj pytanie.

## Czego nie robisz sam

Otwarcie okna kontraktowego i publikacja raportu do bliskich należą do człowieka.
**Zakaz samodzielnego merge do `staging` ani `main`:** Autor nigdy nie wykonuje merge własnego Pull Requesta. Merge'a (który przez `Closes #…` zamyka issue i przenosi je do „Done”) dokonuje wyłącznie druga osoba z zespołu (Darek lub Michał) po pozytywnym Code Review.

## Gałęzie i wdrożenia

- **Nowe PR-y kierujesz do `staging`** (domyślna gałąź repozytorium). Push na `staging` wdraża podgląd „staging” na Vercelu.
- **`main` = produkcja.** Trafia tam wyłącznie PR promocyjny `staging → main`, scalany commitem scalającym (nie squash), żeby historia obu gałęzi się nie rozjeżdżała.
- **Poprawka pilna na produkcji** idzie PR-em do `main`, a potem od razu `main → staging`, żeby `staging` jej nie cofnął.
- Staging (`staging`) i produkcja (`main`) korzystają z **dwóch osobnych baz Supabase** — migracje uruchamia wyłącznie CI (`.github/workflows/migrate.yml`): push na `staging` migruje bazę stagingową, a scalenie `staging → main` migruje produkcję (po zatwierdzeniu środowiska `production`).
- Lokalny development i testy bazodanowe korzystają ze **wspólnego `.env.local` w korzeniu repozytorium** (jeden zestaw zmiennych na raz, bez duplikatu `apps/web/.env.local`) oraz z lokalnego Supabase (`supabase start` z `supabase/config.toml`).
