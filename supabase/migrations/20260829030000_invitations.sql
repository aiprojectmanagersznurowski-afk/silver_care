-- Migration: 20260829030000_invitations.sql

CREATE TABLE IF NOT EXISTS public.resident_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL DEFAULT public.get_jwt_organization_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
    resident_id uuid NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('family', 'legal_guardian')),
    expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
    revoked_at timestamptz,
    claimed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resident_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_isolation" ON public.resident_invitations
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id()
  );

CREATE POLICY "invitations_org_admin_insert" ON public.resident_invitations
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id() AND
    EXISTS (
      SELECT 1 FROM public.residents
      WHERE residents.id = resident_id
      AND residents.organization_id = public.get_jwt_organization_id()
    ) AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  );

-- Only allowing updates to revoked_at through RPC to maintain integrity, but if we need a policy for it:
-- Org admin cannot arbitrarily update invitations to prevent changing resident_id or role
CREATE POLICY "invitations_org_admin_update" ON public.resident_invitations
  FOR UPDATE
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') = 'org_admin'
  )
  WITH CHECK (
    -- Only allow updating revoked_at (no changes to resident_id, role, organization_id)
    organization_id = public.get_jwt_organization_id()
  );

-- To enforce the restriction that only revoked_at can be updated, we use a trigger
CREATE OR REPLACE FUNCTION public.prevent_invitation_tampering()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.organization_id <> OLD.organization_id OR NEW.resident_id <> OLD.resident_id OR NEW.role <> OLD.role OR NEW.created_at <> OLD.created_at OR NEW.expires_at <> OLD.expires_at THEN
    RAISE EXCEPTION 'Only revoked_at and claimed_at can be updated on an invitation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_invitation_tampering
  BEFORE UPDATE ON public.resident_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_invitation_tampering();

-- RPC for revoking an invitation
CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.resident_invitations
  SET revoked_at = now()
  WHERE id = p_invitation_id
  AND revoked_at IS NULL
  AND claimed_at IS NULL;
END;
$$;
