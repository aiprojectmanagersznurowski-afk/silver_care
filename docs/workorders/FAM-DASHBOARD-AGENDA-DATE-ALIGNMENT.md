# Work Order: FAM-DASHBOARD-AGENDA-DATE-ALIGNMENT

## Cel
Spójność nawigacji datami w portalu bliskich, eliminacja błędu sztywnej daty „Dzisiaj” w `DailySummaryHero` przy przeglądaniu historii, oparcie kategorii w `AgendaTimelineClient` na polu `type` z bazy oraz usunięcie przestarzałych komponentów (`ResidentSwitcher.tsx` i `AgendaView.tsx`).

## Zakres wdrożenia
1. **Nagłówek podsumowania dnia (`DailySummaryHero.tsx`):**
   - Dodanie `selectedDate` do propsów.
   - Dynamiczne wyliczanie etykiety daty: „Dzisiaj”, „Wczoraj” lub pełna sformatowana data historyczna po polsku.
2. **Pulpit rodziny (`FamilyDashboardClient.tsx`):**
   - Przekazanie wybranej daty (`selectedDate`) do `DailySummaryHero`.
   - Wzbogacenie selektora daty o czytelną polską nazwę dnia tygodnia.
3. **Harmonogram planu dnia (`AgendaTimelineClient.tsx`):**
   - Wykorzystanie pola `type` z modelu danych `AgendaItem` w wyznaczaniu kategorii i ikony wydarzenia.
4. **Czyszczenie martwego kodu:**
   - Usunięcie nieużywanych komponentów `ResidentSwitcher.tsx` i `AgendaView.tsx`.
