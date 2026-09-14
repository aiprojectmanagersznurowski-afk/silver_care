-- Migration: 20260914190000_org_provisioning_extended.sql
-- REQ: ORG-PROVISION — Extended atomic organization provisioning with audit logging

-- 1. Upewnij się, że kolumny address i resident_limit istnieją w organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS resident_limit integer DEFAULT 50;

-- 2. Usuń starą sygnaturę 2-argumentową, aby sygnatura z wartościami domyślnymi nie tworzyła niejednoznaczności
DROP FUNCTION IF EXISTS public.provision_organization(text, text);

-- 3. Zaktualizuj procedurę provision_organization
CREATE OR REPLACE FUNCTION public.provision_organization(
  p_org_name text,
  p_admin_email text,
  p_address text DEFAULT NULL,
  p_resident_limit integer DEFAULT 50,
  p_admin_full_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_caller_id uuid;
  v_caller_role text;
BEGIN
  v_caller_id := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'sub',
    auth.uid()::text
  )::uuid;

  v_caller_role := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role',
    ''
  );

  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Odmowa dostępu: Wymagana rola super_admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_org_name IS NULL OR trim(p_org_name) = '' THEN
    RAISE EXCEPTION 'Nazwa placówki jest wymagana';
  END IF;

  IF p_admin_email IS NULL OR trim(p_admin_email) = '' THEN
    RAISE EXCEPTION 'Adres e-mail administratora jest wymagany';
  END IF;

  -- 1. Wstawienie rekordu do tabeli organizations
  INSERT INTO public.organizations (name, address, resident_limit)
  VALUES (trim(p_org_name), NULLIF(trim(p_address), ''), COALESCE(p_resident_limit, 50))
  RETURNING id INTO v_org_id;

  -- 2. Utworzenie konta pierwszego org_admin w auth.users
  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, recovery_sent_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', trim(p_admin_email),
    '',
    now(),
    NULL, NULL,
    jsonb_build_object(
      'provider', 'email',
      'providers', array['email'],
      'role', 'org_admin',
      'organization_id', v_org_id
    ),
    jsonb_build_object(
      'full_name', p_admin_full_name,
      'email_verified', true
    ),
    now(), now(),
    gen_random_uuid()::text,
    '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', trim(p_admin_email)),
    'email', NULL, now(), now()
  );

  -- 3. Rejestracja w audit_logs (action: 'ORGANIZATION_CREATED')
  INSERT INTO public.audit_logs (organization_id, action, performed_by, payload)
  VALUES (
    v_org_id,
    'ORGANIZATION_CREATED',
    v_caller_id,
    jsonb_build_object(
      'organization_name', trim(p_org_name),
      'admin_user_id', v_user_id,
      'resident_limit', COALESCE(p_resident_limit, 50)
    )
  );

  RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_organization(text, text, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_organization(text, text, text, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.provision_organization(text, text, text, integer, text) TO authenticated;
