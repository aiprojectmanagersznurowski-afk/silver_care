# Work Order: NTF-OUTBOX-CONCURRENCY

## Wymaganie
Rejestr: NTF-REPORT-READY, NTF-NO-PII

## Opis
Eliminacja podwójnych powiadomień SMS/E-mail do bliskich przy równoległym wywołaniu workerów crona:
1. Rozszerzenie tabeli `outbox_notifications` o status `PROCESSING`, `attempts`, `max_attempts`, `locked_at`, `next_retry_at`, `last_error`.
2. Funkcja PostgreSQL `fetch_pending_outbox_notifications` realizująca atomowe pobranie i blokowanie zadań przez `FOR UPDATE SKIP LOCKED`.
3. Obsługa timeoutu blokad (`locked_at < now() - INTERVAL '10 minutes'`) na wypadek awarii procesu nadrzędnego.
4. Funkcja PostgreSQL `handle_outbox_notification_attempt` implementująca wykładniczy backoff ponowień oraz oznaczanie `FAILED` dopiero po wyczerpaniu limitu 3 prób.
5. Pełna zgodność z ADR-008 i NTF-NO-PII (maskowanie w logach, brak danych osobowych w wiadomościach).

## Kryteria akceptacji
- AC1: Dwa równoległe zapytania `fetch_pending_outbox_notifications` pobierają rozłączne zbiory rekordów (zero duplikatów).
- AC2: Błąd wysyłki inkrementuje próby i ustawia `next_retry_at` z backoffem.
- AC3: Po przekroczeniu `max_attempts` zadanie przechodzi w status `FAILED`.
