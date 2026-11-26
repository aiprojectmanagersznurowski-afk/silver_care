-- @REQ: SEC-RETENTION
-- @REQ: SEC-403-LOGGING
-- @REQ: SEC-AUDIT-APPEND-ONLY

REVOKE EXECUTE ON FUNCTION public.enforce_retention_policy(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_retention_policy(integer)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_access_denied(uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_access_denied(uuid, uuid, text, jsonb)
  TO service_role;
