# Work Order: Agenda Personelu (NUR-AGENDA)

## Metadane
- **Wymagania:** `NUR-AGENDA`
- **Domena:** staff
- **Ryzyko:** LOW
- **Powiązania:** `tests/logic/nur_agenda.test.ts`, `tests/logic/ui.test.ts`, `packages/contracts/src/ui/nurse.ts`

## Cel
Zapewnienie personelowi opiekuńczemu i pielęgniarskiemu przejrzystego harmonogramu dnia placówki oraz możliwości definiowania i stosowania szablonów aktywności dla pensjonariuszy.

## Kryteria Akceptacji
1. Każdy element agendy zawiera określony typ zdarzenia (np. posiłek, terapia, aktywność, leki), tytuł oraz godzinę rozpoczęcia.
2. Element bez przypisanego identyfikatora pensjonariusza (`resident_id: null`) dotyczy wszystkich pensjonariuszy oddziału/placówki.
3. System wspiera szablony agendy (`is_template: true`), które mogą być wielokrotnie powielane jako nowe instancje w bieżącym dniu dyżuru.
4. Spójność uprawnień i separacja danych placówki (`organization_id`).

## Podsumowanie Realizacji
- **KONTRAKT I TYPY:** W `packages/contracts/src/ui/nurse.ts` zdefiniowano interfejs `NurseBoard` zawierający tablicę zadań agendy.
- **LOGIKA I TESTY:** W `tests/logic/nur_agenda.test.ts` oraz `tests/logic/ui.test.ts` zweryfikowano poprawność tworzenia elementów agendy, obsługę wpisów ogólnych (`resident_id: null`) oraz aplikowanie szablonów (`@REQ: NUR-AGENDA`).
