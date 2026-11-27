-- @REQ: VOICE-RESIDENT-ASSIGN
-- @REQ: VOICE-DRAFT-ISOLATION
-- @REQ: ORG-ISOLATION
-- @REQ: SEC-MFA-STAFF

INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-recordings', 'voice-recordings', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE TABLE public.voice_captures (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('APP', 'APP_GENERAL', 'DEVICE')),
  source_key uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  author_id uuid REFERENCES auth.users (id) ON DELETE RESTRICT,
  selected_resident_id uuid REFERENCES public.residents (id) ON DELETE CASCADE,
  device_id uuid,
  session_id uuid,
  session_seq integer,
  recorded_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  clock_state text NOT NULL DEFAULT 'SYNCED' CHECK (clock_state IN ('SYNCED', 'RELATIVE', 'UNKNOWN')),
  status text NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'TRANSCRIBING', 'SEGMENTED', 'FAILED')),
  UNIQUE (id, organization_id),
  FOREIGN KEY (device_id, organization_id) REFERENCES public.voice_devices (id, organization_id),
  CHECK (pg_catalog.split_part(storage_path, '/', 1) = organization_id::text),
  CHECK ((source = 'APP') = (selected_resident_id IS NOT NULL)),
  CHECK (
    (source = 'DEVICE' AND device_id IS NOT NULL AND session_id IS NOT NULL
      AND session_seq IS NOT NULL AND session_seq > 0 AND author_id IS NULL)
    OR (source <> 'DEVICE' AND author_id IS NOT NULL
      AND device_id IS NULL AND session_id IS NULL AND session_seq IS NULL)
  )
);

CREATE UNIQUE INDEX voice_captures_app_retry
  ON public.voice_captures (organization_id, author_id, source_key) WHERE source <> 'DEVICE';
CREATE UNIQUE INDEX voice_captures_device_retry
  ON public.voice_captures (device_id, source_key) WHERE source = 'DEVICE';
CREATE UNIQUE INDEX voice_captures_device_session_order
  ON public.voice_captures (device_id, session_id, session_seq) WHERE source = 'DEVICE';
CREATE INDEX voice_captures_retention ON public.voice_captures (organization_id, received_at);
CREATE INDEX voice_captures_selected_resident ON public.voice_captures (selected_resident_id)
  WHERE selected_resident_id IS NOT NULL;

CREATE TABLE public.voice_segments (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  organization_id uuid NOT NULL,
  capture_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  start_ms integer NOT NULL CHECK (start_ms >= 0),
  end_ms integer NOT NULL CHECK (end_ms > start_ms),
  -- Transkrypt przechowywany jest poza wierszem używanym w walidacji SQL.
  transcript_path text,
  assignment_status text NOT NULL DEFAULT 'PENDING'
    CHECK (assignment_status IN ('PENDING', 'RESIDENT', 'FACILITY', 'UNASSIGNABLE')),
  resident_id uuid REFERENCES public.residents (id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users (id) ON DELETE RESTRICT,
  author_attribution text NOT NULL DEFAULT 'UNKNOWN'
    CHECK (author_attribution IN ('AUTHENTICATED_SESSION', 'DECLARED_SESSION', 'MANUAL_SEGMENT_CORRECTION', 'UNKNOWN')),
  UNIQUE (capture_id, ordinal),
  UNIQUE (id, organization_id),
  FOREIGN KEY (capture_id, organization_id)
    REFERENCES public.voice_captures (id, organization_id) ON DELETE CASCADE,
  CHECK (transcript_path IS NULL OR pg_catalog.split_part(transcript_path, '/', 1) = organization_id::text),
  CHECK ((assignment_status = 'RESIDENT') = (resident_id IS NOT NULL)),
  CHECK ((author_attribution = 'UNKNOWN') = (author_id IS NULL)),
  CHECK (assignment_status NOT IN ('RESIDENT', 'FACILITY') OR author_id IS NOT NULL)
);
CREATE INDEX voice_segments_resident ON public.voice_segments (resident_id) WHERE resident_id IS NOT NULL;

CREATE TABLE public.voice_assignment_queue (
  segment_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  shift_definition_id uuid,
  shift_date date,
  reasons text[] NOT NULL CHECK (
    pg_catalog.cardinality(reasons) > 0
    AND reasons <@ ARRAY['NO_MATCH', 'MULTIPLE_MATCHES', 'CONFLICTING_EVIDENCE',
      'MIXED_SEGMENT', 'NO_AUTHOR', 'TIME_UNCERTAIN']::text[]
    AND pg_catalog.array_position(reasons, NULL) IS NULL
  ),
  candidates uuid[] NOT NULL DEFAULT '{}' CHECK (pg_catalog.array_position(candidates, NULL) IS NULL),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users (id) ON DELETE RESTRICT,
  FOREIGN KEY (segment_id, organization_id)
    REFERENCES public.voice_segments (id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (shift_definition_id, organization_id)
    REFERENCES public.shift_definitions (id, organization_id),
  CHECK ((shift_definition_id IS NULL) = (shift_date IS NULL)),
  CHECK ((decided_at IS NULL) = (decided_by IS NULL))
);
CREATE INDEX voice_assignment_queue_open
  ON public.voice_assignment_queue (organization_id, shift_definition_id, shift_date, created_at)
  WHERE decided_at IS NULL;

CREATE FUNCTION private.guard_voice_source_tenant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
SET log_parameter_max_length_on_error = 0
AS $$
DECLARE
  v_resident uuid;
BEGIN
  IF TG_TABLE_NAME = 'voice_captures' THEN
    v_resident := NEW.selected_resident_id;
  ELSE
    v_resident := NEW.resident_id;
  END IF;

  IF v_resident IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.residents r
    WHERE r.id = v_resident AND r.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'VOICE_SOURCE_INVALID_RESIDENT' USING ERRCODE = '23514';
  END IF;

  IF NEW.author_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = NEW.author_id
    AND u.raw_app_meta_data->>'organization_id' = NEW.organization_id::text
    AND u.raw_app_meta_data->>'role' IN ('nurse', 'org_admin')
  ) THEN
    RAISE EXCEPTION 'VOICE_SOURCE_INVALID_AUTHOR' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_voice_source_tenant() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER voice_captures_tenant BEFORE INSERT OR UPDATE OF organization_id, selected_resident_id, author_id
  ON public.voice_captures FOR EACH ROW EXECUTE FUNCTION private.guard_voice_source_tenant();
CREATE TRIGGER voice_segments_tenant BEFORE INSERT OR UPDATE OF organization_id, resident_id, author_id
  ON public.voice_segments FOR EACH ROW EXECUTE FUNCTION private.guard_voice_source_tenant();

ALTER TABLE public.voice_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_assignment_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.voice_captures, public.voice_segments, public.voice_assignment_queue
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_captures, public.voice_segments, public.voice_assignment_queue
  TO service_role;
GRANT SELECT ON public.voice_assignment_queue TO authenticated;

CREATE POLICY voice_assignment_queue_open_staff ON public.voice_assignment_queue
  FOR SELECT TO authenticated USING (
    decided_at IS NULL
    AND organization_id = (SELECT public.get_jwt_organization_id())
    AND public.has_org_feature(organization_id, 'module_voice_and_reports')
    AND CASE WHEN ((SELECT auth.jwt())->>'aal') = 'aal2'
      THEN COALESCE((SELECT public.check_mfa_requirement()), false) ELSE false END
    AND CASE (SELECT auth.jwt())->'app_metadata'->>'role'
      WHEN 'org_admin' THEN true
      WHEN 'nurse' THEN public.is_shift_lead(shift_definition_id, shift_date)
      ELSE false END
  );
