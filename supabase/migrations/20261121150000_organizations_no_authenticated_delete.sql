-- @REQ: ORG-ISOLATION
-- Align public.organizations RLS with contracts/roles.contract.mjs (MATRIX.organizations.delete: []).
DROP POLICY IF EXISTS "organizations_delete" ON public.organizations;
