# Work Order: Optymalizacja indeksów kompozytowych pod kątem RLS (SEC-RLS-PERF)

## Wymaganie
Wraz ze wzrostem liczby placówek i pensjonariuszy, zapytania z politykami RLS wykonujące podzapytania (np. sprawdzające przynależność przez `organization_id` i relacje) wymagają dedykowanych indeksów B-Tree, aby unikać kosztownych Sequential Scans.

Wymagania powiązane w kontrakcie:
- `ORG-ISOLATION`: Zapytania filtrujące po organizacji i relacjach pensjonariusza.
- `ADM-FACILITY-OCCUPANCY`: Wydajne pobieranie aktywnych przypisań do łóżek.
- `REPORT-APPROVAL`: Szybkie wyszukiwanie opublikowanych raportów per pensjonariusz.

## Cele
1. Utworzyć dedykowane indeksy B-Tree:
   - `idx_residents_org_archived` na `public.residents(organization_id, archived_at)`
   - `idx_daily_reports_resident_status` na `public.daily_reports(resident_id, status, created_at DESC)`
   - `idx_daily_logs_resident_created` na `public.daily_logs(resident_id, created_at DESC)`
   - `idx_bed_assignments_active` na `public.bed_assignments(bed_id, resident_id) WHERE unassigned_at IS NULL`
   - `idx_outbox_notifications_pending` na `public.outbox_notifications(status, created_at) WHERE status = 'PENDING'`
2. Napisać test weryfikujący obecność indeksów w `pg_indexes`.
3. Potwierdzić brak regresji izolacji i uprawnień w istniejących testach RLS.
4. Utrzymać 100% zieloną bramkę weryfikacyjną.
