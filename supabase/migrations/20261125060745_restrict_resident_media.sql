-- @REQ: ORG-ISOLATION
CREATE FUNCTION private.resident_media_allowed(p_name text, p_write boolean)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH path AS (
    SELECT string_to_array(p_name, '/') AS parts, auth.jwt()->'app_metadata'->>'role' AS role
  ), target AS (
    SELECT role, parts[1] = 'contracts' AS is_contract,
      CASE
        WHEN parts[1] = 'contracts' AND cardinality(parts) = 3 AND parts[3] <> '' THEN parts[2]
        WHEN parts[1] <> 'contracts' AND cardinality(parts) = 2 AND parts[2] <> '' THEN parts[1]
      END AS resident_id
    FROM path
  )
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM target t
    JOIN public.residents r ON r.id =
      CASE WHEN pg_input_is_valid(t.resident_id, 'uuid') THEN t.resident_id::uuid END
    WHERE r.organization_id = public.get_jwt_organization_id()
      AND CASE
        WHEN t.is_contract THEN t.role = 'org_admin'
          AND public.has_org_feature(r.organization_id, 'module_documents_contracts')
        WHEN t.role IN ('org_admin', 'nurse') THEN true
        WHEN NOT p_write AND t.role IN ('family', 'legal_guardian') THEN
          public.is_relative_active_or_retained(r.id)
          AND EXISTS (
            SELECT 1 FROM public.resident_media m
            WHERE m.resident_id = r.id AND m.storage_path = p_name AND m.content_type LIKE 'image/%'
          )
        ELSE false
      END
  );
$$;

REVOKE ALL ON FUNCTION private.resident_media_allowed(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.resident_media_allowed(text, boolean) TO authenticated;

DROP POLICY "Authenticated users can read resident-media" ON storage.objects;
DROP POLICY "Authenticated users can insert into resident-media" ON storage.objects;
CREATE POLICY resident_media_scoped_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resident-media' AND private.resident_media_allowed(name, false));
CREATE POLICY resident_media_scoped_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resident-media' AND private.resident_media_allowed(name, true));

CREATE POLICY resident_media_contract_metadata ON public.resident_media AS RESTRICTIVE FOR SELECT TO authenticated
  USING (storage_path NOT LIKE 'contracts/%'
    OR (SELECT auth.jwt())->'app_metadata'->>'role' = 'org_admin');
