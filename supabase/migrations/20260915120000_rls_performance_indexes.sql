-- Migration: RLS performance composite indexes (SEC-RLS-PERF)
CREATE INDEX IF NOT EXISTS idx_residents_org_archived
    ON public.residents(organization_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_daily_reports_resident_status
    ON public.daily_reports(resident_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_logs_resident_created
    ON public.daily_logs(resident_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bed_assignments_active
    ON public.bed_assignments(bed_id, resident_id)
    WHERE unassigned_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outbox_notifications_pending
    ON public.outbox_notifications(status, created_at)
    WHERE status = 'PENDING';
