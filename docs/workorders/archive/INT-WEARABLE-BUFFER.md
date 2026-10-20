# Work Order: INT-WEARABLE-BUFFER

## Wymaganie
Rejestr: INT-INGEST-PRECONDITIONS, INT-NORMALIZATION, INT-CORE-DECOUPLED

## Opis
Skalowalny bufor wsadowy i mechanizm deduplikacji dla telemetrii z urządzeń ubieralnych:
1. Funkcja PostgreSQL `process_ingest_batch(p_org_id, p_res_id, p_provider, p_payloads)` przyjmująca paczki punktów pomiarowych w formacie JSONB.
2. Pojedyncza weryfikacja warunków wstępnych (`INT-INGEST-PRECONDITIONS`) dla całej paczki:
   - status pensjonariusza (`archived_at IS NULL`)
   - aktywna zgoda w `consent_ledger` (`purpose = 'wellness_data_ingest' AND revoked_at IS NULL`)
   - rejestracja pojedynczego wpisu `INGEST_REJECTED` w `audit_logs` przy odrzuceniu paczki.
3. Transakcyjna normalizacja wartości (np. ISO8601 `PT30M` na minuty) oraz deduplikacja `ON CONFLICT (deduplication_id) DO NOTHING`.
4. Brak wycieku danych medycznych do warstwy rodziny (zgodność z MDR i ADR-005).

## Kryteria akceptacji
- AC1: Paczka z próbkami pomiarowymi dla pensjonariusza z aktywną zgodą wykonuje się wsadowo w pojedynczej transakcji.
- AC2: Próba zapisu dla pensjonariusza bez zgody lub zarchiwizowanego odrzuca całą paczkę i generuje `INGEST_REJECTED` w `audit_logs`.
- AC3: Zduplikowane próbki telemetryczne (`dedup_id`) są ignorowane bez rzucania błędów.
