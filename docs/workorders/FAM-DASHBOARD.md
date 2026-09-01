# Work Order: Panel Rodziny (FAM-DASHBOARD)

## Metadane
- **Wymagania:** `FAM-DASHBOARD`
- **Domena:** family
- **Ryzyko:** MEDIUM

## Cel
Stworzenie widoku raportu dziennego dla rodziny. Bliski musi zobaczyć najnowszy zatwierdzony (opublikowany) raport dnia podopiecznego. Zgodnie z wymaganiami UI pokazuje też wyraźnie datę raportu, aby było jasne, że przed publikacją dzisiejszego widać jeszcze raport wczorajszy.

## Kryteria Akceptacji
1. Widok pobiera wyłącznie rekordy ze statusem `PUBLISHED`. (Już zabezpieczone przez RLS na tabeli `daily_reports`).
2. API wyszukuje raporty dla zadanego pensjonariusza sortując malejąco po dacie (`created_at DESC`) i zwraca najnowszy (1 rekord).
3. Przed publikacją widoczny jest raport z dnia poprzedniego z jawną datą.
4. Brak raportu wyzwala stan pusty (zgodnie z `UI-FOUR-STATES`) z informacją "Brak raportu - pojawi się wkrótce".

## Plan Realizacji

### 1. Baza Danych
- Tabela `daily_reports` i odpowiednia polityka RLS (`Family can read published daily reports`) już istnieją i działają prawidłowo. 
- Brak potrzeby nowej migracji dla logiki odczytu, o ile schemat jest poprawny. Trzeba tylko napisać test bazy danych `tests/db/fam_dashboard.test.ts` weryfikujący czy rola `family` faktycznie odczytuje wyłącznie status `PUBLISHED`.

### 2. Frontend: API (Next.js) & Hook
- Stworzenie bezpiecznego endpointu API `GET /api/residents/[id]/report/latest` pobierającego z bazy najnowszy `PUBLISHED` raport.
- Napisanie hooka `useLatestReport(residentId)`.

### 3. Frontend: Widok Komponentu
- Stworzenie `DailyReportViewer`, który obsłuży stany `loading`, `empty`, `error` i wyrenderuje raport.

### 4. Testy (Vitest)
- Test bazodanowy RLS weryfikujący dostęp rodziny do `daily_reports`.
- Test jednostkowy dla komponentu / logiki upewniający się, że 4 stany są obsłużone.
