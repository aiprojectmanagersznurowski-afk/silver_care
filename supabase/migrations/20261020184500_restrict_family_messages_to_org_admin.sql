-- Migration: 20261020184500_restrict_family_messages_to_org_admin.sql
-- Zmiana kontraktowa (@REQ: FAM-MESSAGES, contracts/roles.contract.mjs):
-- Dostęp do odczytu i odpowiadania w family_messages po stronie placówki posiada wyłącznie org_admin.
-- Rola nurse (personel opiekuńczy / wsparcie) nie posiada dostępu do wiadomości od rodzin.

-- 1. Aktualizacja polityki SELECT na family_messages (wyłącznie org_admin oraz powiązani family / legal_guardian)
DROP POLICY IF EXISTS "family_messages_select" ON public.family_messages;
DROP POLICY IF EXISTS "family_messages_admin_select" ON public.family_messages;

CREATE POLICY "family_messages_select" ON public.family_messages
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    (
      COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
      OR
      (
        COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('family', 'legal_guardian') AND
        relative_user_id = auth.uid()
      )
    )
  );

-- 2. Aktualizacja polityki INSERT dla odpowiedzi z placówki (wyłącznie org_admin)
DROP POLICY IF EXISTS "family_messages_staff_insert" ON public.family_messages;

CREATE POLICY "family_messages_staff_insert" ON public.family_messages
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin' AND
    is_from_family = false AND
    staff_user_id = auth.uid()
  );
