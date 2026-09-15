-- Migration: Self-service security and access logs (NUR-PROFILE-SECURITY)

CREATE TABLE IF NOT EXISTS public.security_access_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by UUID NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.security_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own security access logs" ON public.security_access_logs;
CREATE POLICY "Users can read own security access logs"
    ON public.security_access_logs
    FOR SELECT
    TO authenticated
    USING (
        performed_by = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
        OR (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'super_admin'
    );

CREATE OR REPLACE FUNCTION public.log_self_password_change()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid;
  v_org_id uuid;
BEGIN
  v_uid := (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;
  v_org_id := (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'organization_id')::uuid;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated caller' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.security_access_logs (
    organization_id,
    action,
    performed_by,
    payload
  ) VALUES (
    v_org_id,
    'password_self_change',
    v_uid,
    jsonb_build_object('timestamp', now())
  );

  INSERT INTO public.audit_logs (
    organization_id,
    action,
    performed_by,
    payload
  ) VALUES (
    v_org_id,
    'password_self_change',
    v_uid,
    jsonb_build_object('target_user_id', v_uid, 'timestamp', now())
  );
END;
$$;
