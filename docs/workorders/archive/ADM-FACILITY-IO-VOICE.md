# Work Order: ADM-FACILITY-IO-VOICE

## Wymaganie
Rejestr: ADM-FACILITY-MANAGE (ADR-012), ADM-FACILITY-OCCUPANCY (ADR-012)
Trello: Karta #2 — ADM-FACILITY-IO-VOICE (Lista Presentation MDR/UI)

## Opis
Moduł dwukierunkowej wymiany danych struktury placówki (pokoje i łóżka) oraz asystent głosowy:
1. Eksport struktury placówki do plików XLSX (arkusze Pokoje i Łóżka ze statusem zajętości) oraz JSON.
2. Szablon XLSX z walidacją formatu do pobrania przez administratora.
3. Bezpieczny, dwuetapowy import struktury placówki (Dry-Run z weryfikacją kolizji numerów pokoi i etykiet łóżek + Commit z atomowym zapisem).
4. Głosowe dyktowanie definicji pokoju: nagranie mowy przez dyktafon przeglądarkowy, transkrypcja w chmurze (Groq) i ekstrakcja parametrów (numer pokoju, piętro, sektor, liczba/etykiety łóżek) przez europejski LLM w EOG do edytowalnego podglądu formularza przed zapisem.
5. Poprawa bezpieczeństwa: weryfikacja uprawnień (RBAC: org_admin/admin) oraz izolacja placówki (`organization_id`) w endpointach `/api/facility/rooms` i `/api/facility/beds/assign`.
6. Poprawa schematu zapisów do tabeli `audit_logs` (`performed_by` i `payload`).
7. Uzupełnienie obsługi `admission_date` w procesie masowego importu pensjonariuszy.

## Kryteria akceptacji
- AC1: Administrator może wyeksportować strukturę placówki do XLSX i JSON.
- AC2: Pobranie szablonu generuje plik XLSX z nagłówkami Piętro, Numer pokoju, Sektor, Liczba łóżek, Etykiety łóżek.
- AC3: Walidacja importu (Dry-Run) wykrywa duplikaty w pliku oraz kolizje z istniejącymi pokojami placówki, blokując niepoprawne wiersze.
- AC4: Zatwierdzenie importu (Commit) tworzy pokoje i łóżka z przypisaniem do `organization_id` zalogowanego administratora oraz odnotowuje audyt `FACILITY_SCHEMA_IMPORTED`.
- AC5: Dyktowanie głosowe poprawnie parsuje parametry pokoju i wypełnia formularz z możliwością edycji przed dodaniem pokoju.
- AC6: Operacje na pokojach i łóżkach wymagają roli `org_admin`/`admin` i nie pozwalają na manipulację danymi obcych placówek (brak wycieku cross-tenant).
