-- 1. Aktualizacja RLS dla tabeli organizations (ograniczenie INSERT do super_admin)
-- Najpierw usuniemy dotychczasową politykę "organizations_insert_policy"
DROP POLICY IF EXISTS "organizations_insert_policy" ON organizations;

DROP POLICY IF EXISTS "organizations_super_admin_insert" ON organizations;
CREATE POLICY "organizations_super_admin_insert" ON organizations
  FOR INSERT
  WITH CHECK (
    -- Tylko super_admin może tworzyć organizacje
    COALESCE(
      current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role',
      ''
    ) = 'super_admin'
  );

-- Zaktualizujmy też politykę odczytu (SELECT), żeby super_admin widział organizacje
DROP POLICY IF EXISTS "organizations_isolation" ON organizations;
CREATE POLICY "organizations_isolation" ON organizations
  FOR SELECT
  USING (
    id = public.get_jwt_organization_id()
    OR 
    COALESCE(
      current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role',
      ''
    ) = 'super_admin'
  );

-- 2. Funkcja do provisioningu
-- Zdefiniowana jako SECURITY DEFINER, by mieć uprawnienia do zapisu w auth.users
CREATE OR REPLACE FUNCTION public.provision_organization(p_org_name text, p_admin_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_caller_role text;
BEGIN
  -- Weryfikacja uprawnień (super_admin)
  v_caller_role := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role',
    ''
  );
  
  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Odmowa dostępu: Wymagana rola super_admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Utworzenie organizacji
  INSERT INTO organizations (name)
  VALUES (p_org_name)
  RETURNING id INTO v_org_id;

  -- Utworzenie użytkownika w auth.users
  -- Wykorzystujemy wbudowane obejście tworzenia użytkownika.
  -- Supabase Auth wymaga także rekordu w auth.identities.
  v_user_id := gen_random_uuid();
  
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, recovery_sent_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', p_admin_email,
    '', -- no password yet
    NULL, -- not confirmed
    NULL, NULL,
    jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', 'org_admin', 'organization_id', v_org_id),
    '{}', now(), now(),
    gen_random_uuid()::text, -- token for invitation/confirmation
    '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id, v_user_id::text, jsonb_build_object('sub', v_user_id::text, 'email', p_admin_email), 'email', NULL, now(), now()
  );

  RETURN v_org_id;
END;
$$;
