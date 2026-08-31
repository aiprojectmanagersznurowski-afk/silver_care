ALTER TABLE public.resident_invitations ADD COLUMN email text;

-- Remove old trigger
DROP TRIGGER IF EXISTS check_invitation_tampering ON public.resident_invitations;

-- Update function to include email
CREATE OR REPLACE FUNCTION public.prevent_invitation_tampering()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.organization_id <> OLD.organization_id OR NEW.resident_id <> OLD.resident_id OR NEW.role <> OLD.role OR NEW.created_at <> OLD.created_at OR NEW.expires_at <> OLD.expires_at OR (NEW.email IS DISTINCT FROM OLD.email) THEN
    RAISE EXCEPTION 'Only revoked_at and claimed_at can be updated on an invitation';
  END IF;
  RETURN NEW;
END;
$$;

-- Re-attach trigger
CREATE TRIGGER check_invitation_tampering
  BEFORE UPDATE ON public.resident_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_invitation_tampering();
