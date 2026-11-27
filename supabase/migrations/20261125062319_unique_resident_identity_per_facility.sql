-- @REQ: ADM-RESIDENT-ADD @REQ: SEC-PESEL-HASH
-- A conflict aborts the complete insert. Historical duplicates need reconciliation
-- before this constraint can be applied.
CREATE UNIQUE INDEX residents_organization_identity_key
  ON public.residents (organization_id, pesel_hash)
  WHERE pesel_hash IS NOT NULL;
