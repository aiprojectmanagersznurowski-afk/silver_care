-- Migration: Expand RLS policies on voice notes, logs, and reports for all staff roles (nurse, paramedic, caregiver, org_admin, super_admin, admin)

DROP POLICY IF EXISTS "Nurse can create voice draft note" ON public.voice_draft_notes;
DROP POLICY IF EXISTS "Staff can create voice draft note" ON public.voice_draft_notes;
CREATE POLICY "Staff can create voice draft note"
    ON public.voice_draft_notes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('nurse', 'paramedic', 'caregiver', 'org_admin', 'super_admin', 'admin'))
        OR
        ((current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role') IN ('nurse', 'paramedic', 'caregiver', 'org_admin', 'super_admin', 'admin'))
    );

DROP POLICY IF EXISTS "Nurse can read own voice draft note" ON public.voice_draft_notes;
DROP POLICY IF EXISTS "Staff can read own voice draft note" ON public.voice_draft_notes;
CREATE POLICY "Staff can read own voice draft note"
    ON public.voice_draft_notes
    FOR SELECT
    TO authenticated
    USING (
        (
            ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('nurse', 'paramedic', 'caregiver', 'org_admin', 'super_admin', 'admin'))
            OR
            ((current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role') IN ('nurse', 'paramedic', 'caregiver', 'org_admin', 'super_admin', 'admin'))
        )
        AND (
            nurse_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
            OR ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('super_admin', 'org_admin', 'admin'))
        )
    );

DROP POLICY IF EXISTS "Nurse can update own voice draft note" ON public.voice_draft_notes;
DROP POLICY IF EXISTS "Staff can update own voice draft note" ON public.voice_draft_notes;
CREATE POLICY "Staff can update own voice draft note"
    ON public.voice_draft_notes
    FOR UPDATE
    TO authenticated
    USING (
        (
            ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('nurse', 'paramedic', 'caregiver', 'org_admin', 'super_admin', 'admin'))
            OR
            ((current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role') IN ('nurse', 'paramedic', 'caregiver', 'org_admin', 'super_admin', 'admin'))
        )
        AND (
            nurse_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
            OR ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('super_admin', 'org_admin', 'admin'))
        )
    );

DROP POLICY IF EXISTS "Nurse can create daily logs" ON public.daily_logs;
DROP POLICY IF EXISTS "Staff can create daily logs" ON public.daily_logs;
CREATE POLICY "Staff can create daily logs"
    ON public.daily_logs FOR INSERT TO authenticated
    WITH CHECK (
        ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('nurse', 'paramedic', 'caregiver', 'org_admin', 'super_admin', 'admin'))
        OR
        ((current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role') IN ('nurse', 'paramedic', 'caregiver', 'org_admin', 'super_admin', 'admin'))
    );

DROP POLICY IF EXISTS "Nurse can create daily reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Staff can create daily reports" ON public.daily_reports;
CREATE POLICY "Staff can create daily reports"
    ON public.daily_reports FOR INSERT TO authenticated
    WITH CHECK (
        ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('nurse', 'paramedic', 'caregiver', 'org_admin', 'super_admin', 'admin'))
        OR
        ((current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role') IN ('nurse', 'paramedic', 'caregiver', 'org_admin', 'super_admin', 'admin'))
    );
