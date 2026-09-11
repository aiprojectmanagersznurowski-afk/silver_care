# Work Order: Powiadomienie o Raporcie (NTF-REPORT-READY)

## Metadane
- **Wymagania:** `NTF-REPORT-READY`, `NTF-NO-PII`
- **Domena:** notifications
- **Ryzyko:** MEDIUM
- **Powiązania:** `contracts/notifications.contract.mjs` (szablon `family.report_ready`)

## Cel
Automatyczne powiadamianie bliskich i opiekunów prawnych o publikacji nowego dziennego raportu przez personel opiekuńczy. Zgodnie z wytycznymi MDR i RODO powiadomienie nie może zawierać żadnych danych o zdrowiu, metryk fizjologicznych ani danych osobowych (PII).

## Kryteria Akceptacji
1. Wysyłka następuje wyłącznie po publikacji raportu (`status = 'PUBLISHED'`), nigdy po wygenerowaniu brudnopisu.
2. Tabela `outbox_notifications` przechowuje powiadomienia w modelu transactional outbox.
3. Treść wiadomości nie zawiera danych o zdrowiu ani metryk fizjologicznych (czysty, neutralny komunikat z linkiem do logowania).
4. Odbiorcami są wszystkie osoby powiązane z podopiecznym rolą `family` oraz `legal_guardian`.

## Podsumowanie Realizacji
- **TRIGGER BAZODANOWY:** W migracji `20260829140000_notifications.sql` utworzono trigger `trig_daily_report_published` na tabeli `daily_reports`, wstawiający rekord do `outbox_notifications`.
- **PROCESOR OUTBOX:** Endpoint `/api/cron/process-outbox` pobiera oczekujące notyfikacje (`PENDING`), identyfikuje powiązanych użytkowników (`role IN ('family', 'legal_guardian')`) i wysyła neutralne powiadomienie SMS / E-mail.
- **TESTY:** Test `tests/db/notifications.test.ts` potwierdza brak PII i metryk w wygenerowanym powiadomieniu (`@REQ: NTF-REPORT-READY`, `@REQ: NTF-NO-PII`).

