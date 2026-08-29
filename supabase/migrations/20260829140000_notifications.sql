-- Migration: 20260829140000_notifications.sql

-- 1. Create outbox_notifications table (NTF-REPORT-READY, NTF-NO-PII)
CREATE TABLE IF NOT EXISTS public.outbox_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    entity_type text NOT NULL, -- e.g., 'report'
    entity_id uuid NOT NULL,   -- e.g., daily_reports.id
    payload jsonb NOT NULL,    -- Message and minimal context, NO PII
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.outbox_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outbox_notifications_isolation" ON public.outbox_notifications
  FOR SELECT
  USING (organization_id = public.get_jwt_organization_id());

-- 2. Trigger on daily_reports to create a notification when PUBLISHED
CREATE OR REPLACE FUNCTION public.notify_on_report_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF NEW.status = 'PUBLISHED' AND OLD.status <> 'PUBLISHED' THEN
    -- Get organization_id from resident
    SELECT organization_id INTO v_org_id FROM public.residents WHERE id = NEW.resident_id;

    -- Insert notification without PII
    INSERT INTO public.outbox_notifications (organization_id, entity_type, entity_id, payload)
    VALUES (
      v_org_id, 
      'report', 
      NEW.id, 
      '{"message": "New report is ready"}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_report_published ON public.daily_reports;
CREATE TRIGGER trigger_notify_on_report_published
  AFTER UPDATE ON public.daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_report_published();
