-- Migration: 20261022150000_system_status_alerts.sql
-- Story: SC-SUP-05 — Globalne alerty systemowe i status platformy (Wariant A)
-- @REQ: SUP-IAM-PANEL, @REQ: SEC-AUDIT-APPEND-ONLY

CREATE TABLE IF NOT EXISTS public.system_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    message text NOT NULL,
    severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error')),
    status text NOT NULL DEFAULT 'degraded' CHECK (status IN ('operational', 'degraded', 'maintenance')),
    affected_services text[] NOT NULL DEFAULT '{}'::text[],
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
);

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- Odczyt dozwolony dla personelu i administracji (super_admin, org_admin, nurse)
DROP POLICY IF EXISTS "system_alerts_staff_select" ON public.system_alerts;
CREATE POLICY "system_alerts_staff_select" ON public.system_alerts
  FOR SELECT
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '')
    IN ('super_admin', 'org_admin', 'nurse', 'admin', 'facility_manager')
  );

-- Zapis i aktualizacja wyłącznie dla roli super_admin
DROP POLICY IF EXISTS "system_alerts_super_admin_insert" ON public.system_alerts;
CREATE POLICY "system_alerts_super_admin_insert" ON public.system_alerts
  FOR INSERT
  WITH CHECK (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'super_admin'
  );

DROP POLICY IF EXISTS "system_alerts_super_admin_update" ON public.system_alerts;
CREATE POLICY "system_alerts_super_admin_update" ON public.system_alerts
  FOR UPDATE
  USING (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'super_admin'
  )
  WITH CHECK (
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'super_admin'
  );
