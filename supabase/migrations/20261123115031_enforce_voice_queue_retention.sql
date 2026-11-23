-- @REQ: VOICE-RETENTION
-- @REQ: VOICE-RESIDENT-ASSIGN
CREATE FUNCTION private.voice_source_within_retention(p_segment_id uuid, p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_org = public.get_jwt_organization_id() AND EXISTS (
    SELECT 1 FROM public.voice_segments s JOIN public.voice_captures c
      ON c.id = s.capture_id AND c.organization_id = s.organization_id
    LEFT JOIN public.voice_retention_settings r ON r.organization_id = s.organization_id
    WHERE s.id = p_segment_id AND s.organization_id = p_org
      AND c.received_at >= now() - make_interval(days => COALESCE(r.retention_days, 30))
  );
$$;
REVOKE ALL ON FUNCTION private.voice_source_within_retention(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.voice_source_within_retention(uuid,uuid) TO authenticated;

ALTER POLICY voice_assignment_queue_open_staff ON public.voice_assignment_queue USING (
  decided_at IS NULL
  AND organization_id = (SELECT public.get_jwt_organization_id())
  AND public.has_org_feature(organization_id, 'module_voice_and_reports')
  AND CASE WHEN ((SELECT auth.jwt())->>'aal') = 'aal2'
    THEN COALESCE((SELECT public.check_mfa_requirement()), false) ELSE false END
  AND CASE (SELECT auth.jwt())->'app_metadata'->>'role'
    WHEN 'org_admin' THEN true
    WHEN 'nurse' THEN public.is_shift_lead(shift_definition_id, shift_date)
    ELSE false END
  AND private.voice_source_within_retention(segment_id, organization_id)
);
