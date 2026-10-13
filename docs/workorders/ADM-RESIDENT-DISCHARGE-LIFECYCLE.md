# Work Order: ADM-RESIDENT-DISCHARGE-LIFECYCLE

## Metadane
- **Wymaganie:** `ADM-ARCHIVE` (AC1, AC3), `ADM-BED-ASSIGNMENT` (AC3, AC5)
- **User Story:** `[SC-ADM-19]`
- **Domena:** residents / facility
- **Ryzyko:** HIGH
- **Status:** 📝 PROPOZYCJA
- **Zależności:** `ADM-RESIDENT-ADD`, `ADM-BED-ASSIGNMENT`, `ADM-ARCHIVE`

## Cel
Dostarczenie pełnej, bezpiecznej i audytowalnej ścieżki biznesowej zakończenia pobytu pensjonariusza w placówce opiekuńczej.
Funkcjonalność obejmuje:
1. Rejestrację formalnego wypisu pensjonariusza lub faktu zgonu.
2. Zapisanie daty zakończenia umowy (`contract_end_date`) oraz ustandaryzowanego powodu rozwiązania umowy (`contract_end_reason`).
3. W przypadku zgonu — zarejestrowanie daty zgonu (`death_date`).
4. Atomowe zwolnienie zajmowanego łóżka (`bed_assignments.unassigned_at = now()`), aby zasób powrócił do puli wolnych miejsc placówki.
5. Zabezpieczenie dostępu bliskich (ustawienie `archived_at = now()`) zgodnie z wymogami prawnymi i kontraktem `ADM-ARCHIVE`.
6. Zarejestrowanie zdarzenia w faktach `resident_events` (`contract_ended` oraz opcjonalnie `death`), zasilających wskaźniki rotacji i statystyki BI placówki.
7. Zapis operacji w `audit_logs` z blokadą dla trybu podglądu (impersonacji Super Admina).

---

## Kryteria Akceptacji

1. **AC1 (Dostępność akcji w UI):** Na karcie pensjonariusza (`/admin/residents/[id]`) dla aktywnego pensjonariusza dostępny jest czytelny przycisk akcji: **„Wypisz / Zakończ pobyt”** (z dedykowanym dialogiem modalnym).
2. **AC2 (Formularz zakończenia pobytu):** Okno dialogowe umożliwia wybór:
   - Trybu: Zwykłe rozwiązanie umowy / Wypis vs Zgon pensjonariusza.
   - Daty zakończenia pobytu (`contract_end_date`, domyślnie data bieżąca).
   - W przypadku zgonu — daty zgonu (`death_date`).
   - Ustandaryzowanego powodu rozwiązania umowy z listy `CONTRACT_END_REASONS`:
     - `family_request` (Wypis na życzenie rodziny)
     - `transfer` (Przeniesienie do innego ośrodka)
     - `health_improvement` (Poprawa stanu zdrowia)
     - `non_payment` (Brak płatności)
     - `death` (Zgon)
     - `other` (Inne)
   - Opcjonalnych uwag / notatek do rejestru placówki.
3. **AC3 (Atomowe zwolnienie łóżka):** Zakończenie pobytu natychmiast zamyka aktywne przypisanie do łóżka (`unassigned_at = now()`). Obłożenie placówki i dostępność łóżek aktualizują się bezzwłocznie.
4. **AC4 (Wygaszenie aktywnego profilu i archiwizacja):** Zapisuje `archived_at = now()`, co zgodnie z RLS odcina dostęp rodziny do Portalu Rodziny, a personelowi pozostawia dostęp w trybie odczytu (read-only).
5. **AC5 (Zdarzenia analityczne i audyt):** Tworzy rekord w `resident_events` z `event_type = 'contract_ended'` (oraz `'death'` w razie zgonu), co zasila istniejące funkcje BI (`fn_contract_end_reasons`, `fn_deaths_by_stay_length`), oraz wpis w `audit_logs` pod akcją `RESIDENT_DISCHARGE`.
6. **AC6 (Zgodność z RODO i MDR):** Brak słowa „pacjent” w UI i komunikatach. Weryfikacja braku impersonacji Super Admina (`isImpersonating`).

---

## Plan Realizacji

### 1. Model Danych (PostgreSQL)
Wszystkie niezbędne kolumny już istnieją w schemacie bazy danych (`residents.contract_end_date`, `residents.contract_end_reason`, `residents.death_date`, `residents.archived_at` oraz tabela `resident_events` i `bed_assignments`).
Baza nie wymaga modyfikacji DDL ani otwierania okna kontraktowego.

### 2. Akcja serwerowa (`dischargeResidentAction`)
Plik: `apps/web/src/actions/resident-lifecycle.ts`
- Sprawdzenie uprawnień (`org_admin` lub `super_admin`) oraz izolacji `organization_id`.
- Blokada operacji w trybie impersonacji (`assertMutationAllowedDuringImpersonation`).
- Transakcyjna / spójna aktualizacja:
  1. `UPDATE residents SET contract_end_date = ..., contract_end_reason = ..., death_date = ..., archived_at = now() WHERE id = ...`
  2. `UPDATE bed_assignments SET unassigned_at = now() WHERE resident_id = ... AND unassigned_at IS NULL`
  3. `INSERT INTO resident_events (organization_id, resident_id, event_type, event_date, event_reason, metadata, performed_by)`
  4. `INSERT INTO audit_logs (organization_id, user_id, action, target_table, target_id, details)`
- Rewalidacja ścieżek: `/admin/residents`, `/admin/residents/[id]`, `/admin/facility`, `/admin/reports/statistics`, `/admin/reports/daily`.

### 3. Komponent UI (`DischargeResidentDialog`)
Plik: `apps/web/src/components/DischargeResidentDialog.tsx`
- Dialog zgodny ze standardem UI/UX Enterprise (`sm:max-w-xl md:max-w-2xl`).
- Dynamiczne przełączanie pól: po zaznaczeniu opcji „Zgon” automatycznie ustawia powód `death` i pole `death_date`.
- Ostrzeżenie i podsumowanie konsekwencji (zwolnienie łóżka, zakończenie umowy, odcięcie dostępu w Portalu Rodziny).
- Przycisk potwierdzenia z loaderem i bezpiecznym stylem.

### 4. Integracja z widokiem profilu
Plik: `apps/web/src/app/(admin)/admin/residents/[id]/page.tsx`
- Dla pensjonariusza w stanie aktywnym (`isActive`): wyświetlenie przycisku „Wypisz / Zakończ pobyt” obok przycisku „Edytuj”.
- Dla pensjonariusza już wypisanego lub po zgonie: czytelne podsumowanie daty zakończenia, powodu oraz zablokowanie ponownego wypisu.

### 5. Testy Jednostkowe i Integracyjne
Plik: `tests/logic/adm_resident_discharge.test.ts`
- Test logiki walidacji powodów zakończenia umowy i zgonu.
- Test atomowego zwalniania łóżka i generowania zdarzeń BI.
- Test weryfikacji uprawnień roli i ochrony impersonacji.
- Weryfikacja braku słowa „pacjent” (`MDR-VOCABULARY`).

---

## Otwarte Pytania / WYMAGA DECYZJI

1. **WYMAGA DECYZJI: Dostęp rodziny po wypisie pensjonariusza**
   - **Wariant A (Rekomendowany):** Ustawienie `archived_at = now()` natychmiastowo wygasza dostęp rodziny do Portalu Rodziny (zgodnie z `ADM-ARCHIVE`). Rodzina widzi komunikat o zakończeniu pobytu lub wygaśnięciu dostępu.
   - **Wariant B:** Dostęp rodziny pozostaje w trybie tylko do odczytu (read-only) do czasu upłynięcia okresu retencji lub ręcznej archiwizacji przez administratora.
   - *Rekomendacja:* Wariant A, ponieważ pensjonariusz nie przebywa już w placówce, a ewentualne raporty archiwalne wydaje placówka na wniosek.

2. **WYMAGA DECYZJI: Rejestracja zgonu vs wypis**
   - Czy rejestracja zgonu powinna być osobnym przyciskiem („Zgłoś zgon”) czy opcją/powodem w ramach jednego kreatora „Zakończ pobyt / Wypisz”?
   - *Rekomendacja:* Jeden zintegrowany dialog „Zakończ pobyt / Wypisz pensjonariusza” z przełącznikiem „Powód zakończenia pobytu: Zgon / Wypis / Przeniesienie...”, co zapobiega rozproszeniu akcji w nagłówku i zapewnia spójną obsługę zwolnienia łóżka.
