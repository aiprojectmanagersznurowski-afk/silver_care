CREATE OR REPLACE FUNCTION public.is_relative_linked(target_resident_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.resident_relative_links
        WHERE resident_id = target_resident_id
        AND relative_user_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
    );
END;
$$;

-- daily_logs
CREATE TABLE IF NOT EXISTS public.daily_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    nurse_id UUID NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nurse can create daily logs"
    ON public.daily_logs FOR INSERT TO authenticated
    WITH CHECK ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'nurse');

CREATE POLICY "Nurse can read own daily logs"
    ON public.daily_logs FOR SELECT TO authenticated
    USING (
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'nurse'
        AND nurse_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
    );

CREATE POLICY "Nurse can update own daily logs"
    ON public.daily_logs FOR UPDATE TO authenticated
    USING (
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'nurse'
        AND nurse_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
    );

CREATE POLICY "Org Admin can read daily logs"
    ON public.daily_logs FOR SELECT TO authenticated
    USING (
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'org_admin'
        AND EXISTS (
            SELECT 1 FROM public.residents r
            WHERE r.id = daily_logs.resident_id
            AND r.organization_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'organization_id')::uuid
        )
    );

CREATE POLICY "Enforce MFA on daily_logs"
    ON public.daily_logs AS RESTRICTIVE TO authenticated
    USING (public.check_mfa_requirement());

-- daily_reports
CREATE TABLE IF NOT EXISTS public.daily_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    author_id UUID NOT NULL,
    approved_by UUID,
    content JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'DRAFT',
    ai_generated BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nurse can create daily reports"
    ON public.daily_reports FOR INSERT TO authenticated
    WITH CHECK ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'nurse');

CREATE POLICY "Nurse can read own daily reports"
    ON public.daily_reports FOR SELECT TO authenticated
    USING (
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'nurse'
        AND author_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
    );

CREATE POLICY "Nurse can update own daily reports"
    ON public.daily_reports FOR UPDATE TO authenticated
    USING (
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'nurse'
        AND author_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
    );

CREATE POLICY "Org Admin can read daily reports"
    ON public.daily_reports FOR SELECT TO authenticated
    USING (
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'org_admin'
        AND EXISTS (
            SELECT 1 FROM public.residents r
            WHERE r.id = daily_reports.resident_id
            AND r.organization_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'organization_id')::uuid
        )
    );

CREATE POLICY "Org Admin can update daily reports"
    ON public.daily_reports FOR UPDATE TO authenticated
    USING (
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'org_admin'
        AND EXISTS (
            SELECT 1 FROM public.residents r
            WHERE r.id = daily_reports.resident_id
            AND r.organization_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'organization_id')::uuid
        )
    );

-- Family can read only if status is 'PUBLISHED'
CREATE POLICY "Family can read published daily reports"
    ON public.daily_reports FOR SELECT TO authenticated
    USING (
        status = 'PUBLISHED'
        AND (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('family', 'legal_guardian')
        AND public.is_relative_linked(daily_reports.resident_id)
    );

CREATE POLICY "Enforce MFA on daily_reports"
    ON public.daily_reports AS RESTRICTIVE TO authenticated
    USING (
        -- For staff it enforces MFA, for family it allows them (handled inside check_mfa_requirement)
        public.check_mfa_requirement()
    );
