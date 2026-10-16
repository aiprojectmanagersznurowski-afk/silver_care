# Work Order: Kreator Przyjęcia Pensjonariusza z Sugestią Łóżka (ADM-RESIDENT-WIZARD)

## Wymaganie
Administrator placówki (`org_admin`) potrzebuje spójnego kreatora przyjęcia pensjonariusza (Wizard):
1. Krok 1: Weryfikacja PESEL, autouzupełnianie daty urodzenia i płci, poziom opieki (`care_level`), pakiet ZSN.
2. Krok 2: Przypisanie łóżka z opcją inteligentnej sugestii (kryteria: wolne łóżka, zgodność płci w pokoju, mobilność).
3. Krok 3: Oświadczenia i zgody.
4. Atomowa transakcja bazy danych `admit_resident_with_bed(...)` gwarantująca, że przypisanie łóżka i utworzenie pensjonariusza wykonuje się spójnie (lub rollback w razie kolizji zajętości).

Wymagania powiązane w kontrakcie:
- `ADM-RESIDENT-ADD`: Bezpieczne dodawanie pensjonariusza (pesel_hash, organization_id z tokenu).
- `ADM-BED-ASSIGNMENT`: Niezmiennik: jedno łóżko = jeden pensjonariusz, brak podwójnej rezerwacji.
- `ADM-FACILITY-OCCUPANCY`: Natychmiastowa aktualizacja wolnych i zajętych łóżek.
- `UI-FOUR-STATES`: 4 stany komponentu UI (Loading, Empty, Success, Error).

## Cele
1. Utworzyć migrację `supabase/migrations/20260915160000_admit_resident_with_bed.sql` z procedurą `public.admit_resident_with_bed`.
2. Zaimplementować moduł logiki parsującej PESEL i heurystyki łóżek `apps/web/src/lib/admission-helpers.ts`.
3. Zaimplementować Server Action `apps/web/src/actions/admission.ts`.
4. Zaimplementować komponent wizarda `apps/web/src/components/AdmissionWizard.tsx`.
5. Napisać testy `tests/logic/admission_wizard.test.ts` oraz `tests/db/admission_wizard.test.ts`.
6. Zweryfikować bramką `bash scripts/verify.sh --full`.
