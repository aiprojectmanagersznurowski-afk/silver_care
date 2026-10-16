# Work Order: UI-WIZARD-ROUNDS-A11Y-FIX

**Status:** W TRAKCIE  
**Data rozpoczęcia:** 2026-10-10  
**Domeny:** Residents (ADM), Staff (NUR), Presentation (MDR/UI)  
**Powiązane karty Trello:**
- [6aca8994f6009d5de8a345e7] `[ADM-UI-FIX] Rozjazd nagłówka i nieczytelny kontrast (białe na jasnym) w kreatorze przyjęcia`
- [6aca89951614ec07b608424f] `[NUR-ROUNDS-FIX] Naprawa rejestracji rutynowej obserwacji 1-kliknięciem („Stan stabilny” w obchodzie)`
- [6aca89964959edd6c211ba74] `[UI-A11Y-FIX] Dostępność WCAG: wskaźniki fokusu, semantyka kontrolek i kontrast ikon`
**Wymagania kontraktowe:** `@REQ: ADM-RESIDENT-ADD`, `@REQ: NUR-BOARD`, `@REQ: UI-ACCESSIBILITY`, `@REQ: UI-TEMPLATE-ALIGNMENT`  
**Standardy:** SC-ADM-11, SC-NUR-08, NFR-UI-05, WCAG 2.1 AA  

---

## 1. Kontekst i zgłoszone problemy

W wyniku audytu Chrome DevTools AI Assistance oraz weryfikacji manualnej UI zgłoszono następujące błędy:

### 1.1 Rozjazd nagłówka i nieczytelny kontrast w kreatorze przyjęcia (`AdmissionWizard.tsx`)
1. **Rozjazd nagłówka ze stanem sukcesu:** Po przejściu kroku 3 i pomyślnym utworzeniu pensjonariusza (`createdResidentId`), w treści modala pojawia się ekran sukcesu („Przyjęcie zakończone pomyślnie!”), lecz `DialogHeader` nadal wyświetla:
   `Przyjęcie podopiecznego — Krok 3 z 3` oraz opis `Krok 3: Podsumowanie danych i zatwierdzenie przyjęcia.`
2. **Efekt „białe na białym / jasnym” (błąd kontrastu w motywie ciemnym):**
   Przycisk „Przejdź do profilu podopiecznego i dodaj umowę” oraz przyciski nawigacyjne miały twardo zakodowaną klasę `text-white` na tle `bg-primary`.
   W trybie ciemnym `--primary` przyjmuje token `--sc-accent` (`#7FBCA8` — jasna mięta), co powodowało wyświetlanie białego tekstu na jasnomiętowym tle (brak kontrastu, złamanie WCAG).
   Poprawnym rozwiązaniem jest użycie tokena `text-primary-foreground` (`#171614` w trybie ciemnym, zapewniający ciemny tekst na jasnym akcencie).
3. **Niska dostępność wyboru łóżek:**
   Kafle rekomendowanych łóżek w kroku 2 były zaimplementowane jako `<div>` z `onClick`, uniemożliwiając nawigację z klawiatury (brak fokusu, brak `role="button"`).

### 1.2 Błąd przycisku „Stan stabilny” w obchodzie dyżuru (`StaffBoardClient.tsx`)
1. **Co ta funkcja ma robić:**
   W trybie obchodu dyżuru (`Quick-Rounds`, `NUR-CLICK-REDUCTION`), personel może jednym kliknięciem zarejestrować rutynową obserwację seniora („Stan stabilny, podopieczny spokojny, bez uwag”), gdy senior nie wymaga interwencji i jego dzień przebiega spokojnie — bez konieczności czasochłonnego nagrywania pełnej notatki głosowej.
2. **Dlaczego rzuca błąd:**
   Server Action `quickLogRoutineObservationAction` w `apps/web/src/actions/bulk-reports.ts` próbowała wstawiać do tabeli `daily_logs` kolumny `organization_id`, `author_id`, `activity_type`, `notes`, `metadata`, które nie istnieją w schemacie tabeli `daily_logs`.
   Prawidłowa struktura `daily_logs` to: `id`, `resident_id`, `nurse_id`, `data (JSONB)`, `created_at`, `updated_at`.
   Wpis powinien być zapisany jako:
   ```ts
   {
     resident_id: residentId,
     nurse_id: user.id,
     data: {
       action: 'ROUTINE_OBSERVATION',
       note: summary,
       behavioral_items: [summary],
       source: 'quick_rounds_1click',
       recorded_at: new Date().toISOString()
     }
   }
   ```

### 1.3 Usprawnienia dostępności WCAG 2.1 AA (raport DevTools)
1. **Wskaźniki fokusu:** Upewnienie się, że elementy interaktywne mają wyraźny `focus-visible:ring-2 focus-visible:ring-ring`.
2. **Semantyka przycisków:** Zastąpienie interaktywnych elementów `div/span` semantycznymi `<button>` / `<Link>` lub nadanie im `role="button"`, `tabIndex={0}` i obsługi klawiatury (`Enter`/`Space`).
3. **Kontrast ikon:** Kontrast funkcyjnych ikon i przycisków akcji ≥ 3:1.

---

## 2. Kryteria akceptacji

- **AC1:** Po pomyślnym przyjęciu pensjonariusza `DialogHeader` w `AdmissionWizard` wyświetla nagłówek sukcesu: „Przyjęcie podopiecznego zakończone” oraz opis „Podopieczny został zarejestrowany w systemie placówki” (brak rozjazdu „Krok 3 z 3”).
- **AC2:** Wszystkie przyciski akcentowe w `AdmissionWizard` oraz widokach powiązanych stosują token `text-primary-foreground` zamiast sztywnego `text-white`, gwarantując wysoki kontrast tekstu w obu motywach (jasnym i ciemnym).
- **AC3:** Kafle wyboru łóżek w kroku 2 kreatora są semantycznymi kontrolkami `<button type="button">` z pełną dostępnością z klawiatury i widocznym obrysem `focus-visible`.
- **AC4:** Server Action `quickLogRoutineObservationAction` poprawnie zapisuje wpis w tabeli `daily_logs` z polami `resident_id`, `nurse_id` oraz poprawnym obiektem JSONB `data` zgodnym z `validateDailyLogData`.
- **AC5:** Kliknięcie „Stan stabilny” na tablicy personelu w trybie obchodu dyżuru nie rzuca błędu, natychmiast oznacza kafelek pensjonariusza jako „Odnotowano” / „Stabilny” i wyświetla toast sukcesu.

---

## 3. Plan wdrożenia

1. **Faza RED (`node tools/sc-phase.mjs red`):**
   - Przygotowanie testu `tests/logic/ui_wizard_rounds_a11y.test.ts` weryfikującego strukturę `AdmissionWizard`, zachowanie Server Action `quickLogRoutineObservationAction` oraz semantykę i klasy kontrastowe.
2. **Faza GREEN (`node tools/sc-phase.mjs green`):**
   - Poprawa `apps/web/src/actions/bulk-reports.ts` (`quickLogRoutineObservationAction`).
   - Poprawa `apps/web/src/components/AdmissionWizard.tsx` (nagłówek sukcesu, tokeny `text-primary-foreground`, semantyka `<button>`).
   - Weryfikacja `apps/web/src/components/StaffBoardClient.tsx` oraz innych komponentów pod kątem twardo zakodowanych klas `text-white` na elementach `bg-primary`.
3. **Faza VERIFY:**
   - Pełna bramka jakościowa: `bash scripts/verify.sh --full`.
