-- @REQ: REPORT-APPROVAL
-- @REQ: VOICE-DOCK-REPORTS
-- @REQ: VOICE-RESIDENT-ASSIGN
-- @REQ: VOICE-DRAFT-ISOLATION
--
-- Wspólny szkic dobowy daily_reports per (resident_id, report_day w strefie Europe/Warsaw)
-- dla nagrań ogólnych (review_voice_family_facts) oraz notatek o podopiecznym (process_voice_draft_atomic),
-- dla uprawnionych osób z tej samej placówki. Bezpośredni dostęp zachowuje RLS nurse:own.
-- Zapis zachowuje blokadę PUBLISHED i trwałą ochronę ręcznej edycji w obu ścieżkach,
-- obsługi szkiców sprzed migracji oraz wspólnej blokady transakcyjnej dla równoległego pierwszego zapisu.

ALTER TABLE public.family_voice_report_provenance
  ALTER COLUMN source_segment_ids SET DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS app_draft_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS manually_edited boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION private.is_legacy_daily_report_reviewed(
  p_status text,
  p_ai_generated boolean,
  p_content jsonb,
  p_created_at timestamptz,
  p_updated_at timestamptz
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_status IS DISTINCT FROM 'DRAFT'
    OR COALESCE(p_ai_generated, false) IS NOT TRUE
    OR NOT (COALESCE(p_content, '{}'::jsonb) ? 'draft_id')
    OR (p_updated_at IS NOT NULL AND p_created_at IS NOT NULL AND p_updated_at > p_created_at);
$$;

REVOKE ALL ON FUNCTION private.is_legacy_daily_report_reviewed(text, boolean, jsonb, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

-- Backfill istniejących raportów sprzed migracji (najnowszy wpis na parę resident_id + dzień w Europe/Warsaw).
INSERT INTO public.family_voice_report_provenance
  (resident_id, report_day, report_id, last_generated_fingerprint, source_segment_ids, app_draft_entries, manually_edited)
SELECT DISTINCT ON (d.resident_id, (d.created_at AT TIME ZONE 'Europe/Warsaw')::date)
  d.resident_id,
  (d.created_at AT TIME ZONE 'Europe/Warsaw')::date AS report_day,
  d.id AS report_id,
  pg_catalog.md5(COALESCE(d.content->>'text', '')) AS last_generated_fingerprint,
  '{}'::uuid[] AS source_segment_ids,
  CASE
    WHEN NOT private.is_legacy_daily_report_reviewed(d.status, d.ai_generated, d.content, d.created_at, d.updated_at)
         AND NULLIF(pg_catalog.btrim(COALESCE(d.content->>'draft_id', '')), '') IS NOT NULL
         AND pg_catalog.btrim(pg_catalog.replace(
               COALESCE(d.content->>'text', ''),
               'Podsumowanie generowane przy wsparciu AI, zatwierdzone przez personel placówki',
               ''
             )) <> ''
    THEN pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'draft_id', pg_catalog.btrim(d.content->>'draft_id'),
        'author_id', d.author_id,
        'body', pg_catalog.btrim(pg_catalog.replace(
          COALESCE(d.content->>'text', ''),
          'Podsumowanie generowane przy wsparciu AI, zatwierdzone przez personel placówki',
          ''
        ))
      )
    )
    ELSE '[]'::jsonb
  END AS app_draft_entries,
  private.is_legacy_daily_report_reviewed(d.status, d.ai_generated, d.content, d.created_at, d.updated_at) AS manually_edited
FROM public.daily_reports d
WHERE d.created_at IS NOT NULL
ORDER BY
  d.resident_id,
  (d.created_at AT TIME ZONE 'Europe/Warsaw')::date,
  d.created_at DESC,
  d.id DESC
ON CONFLICT (resident_id, report_day) DO NOTHING;

DROP FUNCTION IF EXISTS private.is_daily_report_reviewed_for_caller(uuid);

CREATE OR REPLACE FUNCTION private.sync_app_voice_family_provenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET log_parameter_max_length_on_error = 0
AS $$
DECLARE
  c_disclosure CONSTANT text := 'Podsumowanie generowane przy wsparciu AI, zatwierdzone przez personel placówki';
  v_is_auto boolean := COALESCE(pg_catalog.current_setting('sc.voice_auto_merge', true) = 'true', false);
  v_is_facts boolean := COALESCE(pg_catalog.current_setting('sc.voice_family_facts_merge', true) = 'true', false);
  v_day date;
  v_draft_id text;
  v_draft_body text;
  v_old_draft_id text;
  v_old_body text;
  v_fingerprint text;
  v_prev_report_id uuid;
  v_prev_fingerprint text;
  v_prev_entries jsonb;
  v_prev_manually_edited boolean;
  v_updated_entries jsonb;
BEGIN
  IF v_is_facts THEN
    RETURN NEW;
  END IF;

  IF NOT v_is_auto THEN
    -- Ręczna korekta treści szkicu przez personel trwale oznacza szkic jako zredagowany ręcznie.
    IF TG_OP = 'UPDATE'
       AND COALESCE(NEW.content->>'text', '') IS DISTINCT FROM COALESCE(OLD.content->>'text', '') THEN
      v_day := (NEW.created_at AT TIME ZONE 'Europe/Warsaw')::date;
      UPDATE public.family_voice_report_provenance
        SET manually_edited = true
        WHERE report_id = NEW.id;

      IF NOT FOUND THEN
        INSERT INTO public.family_voice_report_provenance
          (resident_id, report_day, report_id, last_generated_fingerprint, source_segment_ids, app_draft_entries, manually_edited)
        VALUES
          (NEW.resident_id, v_day, NEW.id, pg_catalog.md5(COALESCE(OLD.content->>'text', '')), '{}'::uuid[], '[]'::jsonb, true)
        ON CONFLICT (resident_id, report_day) DO UPDATE
          SET manually_edited = true
          WHERE public.family_voice_report_provenance.report_id = NEW.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'DRAFT' THEN
    RETURN NEW;
  END IF;

  v_day := (NEW.created_at AT TIME ZONE 'Europe/Warsaw')::date;
  v_draft_id := NULLIF(pg_catalog.btrim(COALESCE(pg_catalog.current_setting('sc.voice_current_draft_id', true), '')), '');
  v_draft_body := pg_catalog.btrim(COALESCE(pg_catalog.current_setting('sc.voice_current_draft_body', true), ''));
  v_fingerprint := pg_catalog.md5(COALESCE(NEW.content->>'text', ''));

  SELECT p.report_id, p.last_generated_fingerprint, p.app_draft_entries, p.manually_edited
    INTO v_prev_report_id, v_prev_fingerprint, v_prev_entries, v_prev_manually_edited
    FROM public.family_voice_report_provenance p
    WHERE p.resident_id = NEW.resident_id
      AND p.report_day = v_day
    FOR UPDATE;

  IF NOT FOUND THEN
    v_updated_entries := '[]'::jsonb;

    IF TG_OP = 'UPDATE' THEN
      IF private.is_legacy_daily_report_reviewed(OLD.status, OLD.ai_generated, OLD.content, OLD.created_at, OLD.updated_at) THEN
        RAISE EXCEPTION 'VOICE_FAMILY_DRAFT_ALREADY_REVIEWED' USING ERRCODE = '23514';
      END IF;

      v_old_draft_id := NULLIF(pg_catalog.btrim(COALESCE(OLD.content->>'draft_id', '')), '');
      v_old_body := pg_catalog.btrim(pg_catalog.replace(COALESCE(OLD.content->>'text', ''), c_disclosure, ''));
      IF v_old_draft_id IS NOT NULL AND v_old_draft_id IS DISTINCT FROM v_draft_id AND v_old_body <> '' THEN
        v_updated_entries := pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object('draft_id', v_old_draft_id, 'author_id', OLD.author_id, 'body', v_old_body)
        );
      END IF;
    END IF;

    IF v_draft_id IS NOT NULL AND v_draft_body <> '' THEN
      v_updated_entries := v_updated_entries || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('draft_id', v_draft_id, 'author_id', auth.uid(), 'body', v_draft_body)
      );
    END IF;

    INSERT INTO public.family_voice_report_provenance
      (resident_id, report_day, report_id, last_generated_fingerprint, source_segment_ids, app_draft_entries, manually_edited)
    VALUES
      (NEW.resident_id, v_day, NEW.id, v_fingerprint, '{}'::uuid[], v_updated_entries, false);

    RETURN NEW;
  END IF;

  IF v_prev_report_id = NEW.id THEN
    IF v_prev_manually_edited
       OR (TG_OP = 'UPDATE' AND pg_catalog.md5(COALESCE(OLD.content->>'text', '')) IS DISTINCT FROM v_prev_fingerprint) THEN
      RAISE EXCEPTION 'VOICE_FAMILY_DRAFT_ALREADY_REVIEWED' USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(pg_catalog.jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
      INTO v_updated_entries
      FROM pg_catalog.jsonb_array_elements(COALESCE(v_prev_entries, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
      WHERE elem->>'draft_id' IS DISTINCT FROM v_draft_id;

    IF v_draft_id IS NOT NULL AND v_draft_body <> '' THEN
      v_updated_entries := v_updated_entries || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('draft_id', v_draft_id, 'author_id', auth.uid(), 'body', v_draft_body)
      );
    END IF;

    UPDATE public.family_voice_report_provenance
      SET last_generated_fingerprint = v_fingerprint,
          app_draft_entries = v_updated_entries
      WHERE resident_id = NEW.resident_id
        AND report_day = v_day;

    RETURN NEW;
  END IF;

  -- Jeżeli poprzedni rekord daily_reports dla tego wpisu provenance został usunięty, przejmij śledzenie.
  IF NOT EXISTS (SELECT 1 FROM public.daily_reports d WHERE d.id = v_prev_report_id) THEN
    v_updated_entries := CASE
      WHEN v_draft_id IS NOT NULL AND v_draft_body <> '' THEN
        pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object('draft_id', v_draft_id, 'author_id', auth.uid(), 'body', v_draft_body)
        )
      ELSE '[]'::jsonb
    END;

    UPDATE public.family_voice_report_provenance
      SET report_id = NEW.id,
          last_generated_fingerprint = v_fingerprint,
          source_segment_ids = '{}'::uuid[],
          app_draft_entries = v_updated_entries,
          manually_edited = false
      WHERE resident_id = NEW.resident_id
        AND report_day = v_day;
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION private.sync_app_voice_family_provenance() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS sync_app_voice_family_provenance ON public.daily_reports;
CREATE TRIGGER sync_app_voice_family_provenance
  AFTER INSERT OR UPDATE ON public.daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_app_voice_family_provenance();

CREATE OR REPLACE FUNCTION public.process_voice_draft_atomic(
    p_draft_id UUID,
    p_resident_id UUID,
    p_nurse_id UUID,
    p_daily_log_data JSONB,
    p_report_content JSONB,
    p_ai_model TEXT DEFAULT NULL,
    p_ai_prompt_version TEXT DEFAULT NULL,
    p_ai_generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    p_organization_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
-- Uprawnienia do wspólnego zapisu dotyczą wyłącznie tego RPC. Własność źródła,
-- placówka, rola, MFA i aktywny moduł są sprawdzane przed odczytem i zapisem.
SECURITY DEFINER
SET search_path = ''
SET log_parameter_max_length_on_error = 0
AS $$
DECLARE
    c_disclosure CONSTANT TEXT := 'Podsumowanie generowane przy wsparciu AI, zatwierdzone przez personel placówki';
    v_caller_uid UUID;
    v_caller_role TEXT;
    v_jwt_org_id UUID;
    v_effective_org_id UUID;
    v_effective_ts TIMESTAMPTZ;
    v_draft_status TEXT;
    v_existing_report_id UUID;
    v_existing_report_status TEXT;
    v_existing_report_content JSONB;
    v_log_id UUID;
    v_report_id UUID;
    v_report_day DATE;
    v_day_start TIMESTAMPTZ;
    v_day_end TIMESTAMPTZ;
    v_new_raw_text TEXT;
    v_new_has_disclosure BOOLEAN;
    v_new_clean_body TEXT;
    v_prev_raw_text TEXT;
    v_prev_has_disclosure BOOLEAN;
    v_prev_clean_body TEXT;
    v_combined_text TEXT;
    v_draft_ids JSONB;
    v_req_review BOOLEAN;
    v_final_content JSONB;
    v_is_same_single_draft BOOLEAN;
BEGIN
    -- 0A. Weryfikacja tożsamości wywołującego (auth.uid())
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized caller: nurse_id must match auth.uid()' USING ERRCODE = '42501';
    END IF;

    -- 0B. Weryfikacja roli z JWT ściśle według contracts/roles.contract.mjs
    v_caller_role := COALESCE(
        NULLIF(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'role',
        ''
    );
    IF v_caller_role <> 'nurse' THEN
        RAISE EXCEPTION 'Forbidden role for voice processing' USING ERRCODE = '42501';
    END IF;

    -- 0C. Weryfikacja zgodności p_nurse_id z auth.uid()
    IF p_nurse_id IS DISTINCT FROM v_caller_uid THEN
        RAISE EXCEPTION 'Unauthorized caller: nurse_id must match auth.uid()' USING ERRCODE = '42501';
    END IF;

    -- 0D. Weryfikacja izolacji organizacji
    v_jwt_org_id := public.get_jwt_organization_id();
    v_effective_org_id := COALESCE(p_organization_id, v_jwt_org_id);
    IF v_jwt_org_id IS NULL OR v_effective_org_id IS DISTINCT FROM v_jwt_org_id THEN
        RAISE EXCEPTION 'Draft resident/organization mismatch' USING ERRCODE = '42501';
    END IF;

    PERFORM private.require_report_staff(v_effective_org_id, ARRAY['nurse'], true);

    v_effective_ts := COALESCE(p_ai_generated_at, NOW());
    v_report_day := (v_effective_ts AT TIME ZONE 'Europe/Warsaw')::date;
    v_day_start := v_report_day::timestamp AT TIME ZONE 'Europe/Warsaw';
    v_day_end := (v_report_day + 1)::timestamp AT TIME ZONE 'Europe/Warsaw';

    -- Wspólna blokada transakcyjna na parę (resident_id, report_day) — identyczny klucz jak w review_voice_family_facts.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(concat('voice-family/', p_resident_id::text, '/', to_char(v_report_day, 'YYYY-MM-DD')), 0)
    );

    -- Rola wykonująca RPC widzi wyłącznie wynik dla swojego źródła i swojej placówki.
    SELECT vdn.status INTO v_draft_status
    FROM public.voice_draft_notes vdn
    JOIN public.residents r ON r.id = vdn.resident_id
    WHERE vdn.id = p_draft_id AND vdn.nurse_id = v_caller_uid
      AND r.id = p_resident_id AND r.organization_id = v_effective_org_id
      AND r.archived_at IS NULL
    FOR UPDATE OF vdn FOR KEY SHARE OF r;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Draft resident/organization mismatch' USING ERRCODE = '42501';
    END IF;

    IF v_draft_status = 'PROCESSED' THEN
        SELECT id, CASE WHEN author_id = v_caller_uid THEN content END
        INTO v_existing_report_id, v_existing_report_content
        FROM public.daily_reports
        WHERE resident_id = p_resident_id
          AND (
            content @> jsonb_build_object('draft_id', p_draft_id::text)
            OR content @> jsonb_build_object('draft_ids', jsonb_build_array(p_draft_id::text))
          )
        ORDER BY created_at DESC
        LIMIT 1;

        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'report_id', v_existing_report_id,
            'report_content', v_existing_report_content
        );
    END IF;

    IF jsonb_typeof(p_daily_log_data) IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_report_content) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'Voice processing expects JSON objects' USING ERRCODE = '22023';
    END IF;
    p_daily_log_data := p_daily_log_data || jsonb_build_object('draft_id', p_draft_id);

    -- 2. Zapis / aktualizacja daily_logs (dane medyczne dla personelu)
    SELECT id INTO v_log_id
    FROM public.daily_logs
    WHERE resident_id = p_resident_id
      AND nurse_id = v_caller_uid
      AND data @> jsonb_build_object('draft_id', p_draft_id::text)
    LIMIT 1;

    IF v_log_id IS NOT NULL THEN
        UPDATE public.daily_logs
        SET data = p_daily_log_data,
            updated_at = NOW()
        WHERE id = v_log_id;
    ELSE
        INSERT INTO public.daily_logs (resident_id, nurse_id, data, created_at, updated_at)
        VALUES (p_resident_id, p_nurse_id, p_daily_log_data, NOW(), NOW())
        RETURNING id INTO v_log_id;
    END IF;

    -- 3. Wybierz kanoniczny raport dobowy, niezależnie od autora pierwszego źródła.
    -- Opublikowany raport zamyka dobę także wtedy, gdy istnieje starszy drugi szkic.
    SELECT d.id, d.status, d.content
    INTO v_report_id, v_existing_report_status, v_existing_report_content
    FROM public.daily_reports d
    LEFT JOIN public.family_voice_report_provenance p
      ON p.resident_id = d.resident_id AND p.report_day = v_report_day
    WHERE d.resident_id = p_resident_id
      AND d.created_at >= v_day_start AND d.created_at < v_day_end
    ORDER BY (d.status = 'PUBLISHED') DESC, (d.id = p.report_id) DESC NULLS LAST, d.created_at DESC, d.id DESC
    LIMIT 1
    FOR UPDATE OF d;

    IF v_report_id IS NOT NULL AND v_existing_report_status = 'PUBLISHED' THEN
        RAISE EXCEPTION 'Cannot overwrite published daily report' USING ERRCODE = '42501';
    END IF;

    -- Ochronę ręcznej edycji egzekwuje atomowo trigger SECURITY DEFINER private.sync_app_voice_family_provenance()
    -- podczas UPDATE na public.daily_reports (również dla szkiców sprzed migracji, bez otwierania schematu private dla authenticated).
    v_new_raw_text := COALESCE(p_report_content->>'text', '');
    v_new_has_disclosure := position(c_disclosure in v_new_raw_text) > 0;
    v_new_clean_body := btrim(replace(v_new_raw_text, c_disclosure, ''));

    PERFORM set_config('sc.voice_auto_merge', 'true', true);
    PERFORM set_config('sc.voice_current_draft_id', p_draft_id::text, true);
    PERFORM set_config('sc.voice_current_draft_body', v_new_clean_body, true);

    IF v_report_id IS NOT NULL THEN
        v_is_same_single_draft :=
            (v_existing_report_content->>'draft_id') = p_draft_id::text
            AND jsonb_array_length(COALESCE(v_existing_report_content->'draft_ids', '[]'::jsonb)) <= 1
            AND NOT (COALESCE(v_existing_report_content, '{}'::jsonb) ? 'source_segment_ids');

        IF v_is_same_single_draft THEN
            v_combined_text := v_new_raw_text;
        ELSE
            v_prev_raw_text := COALESCE(v_existing_report_content->>'text', '');
            v_prev_has_disclosure := position(c_disclosure in v_prev_raw_text) > 0;
            v_prev_clean_body := btrim(replace(v_prev_raw_text, c_disclosure, ''));

            IF v_prev_clean_body = '' THEN
                v_combined_text := v_new_clean_body;
            ELSIF v_new_clean_body = '' OR position(v_new_clean_body in v_prev_clean_body) > 0 THEN
                v_combined_text := v_prev_clean_body;
            ELSE
                v_combined_text := v_prev_clean_body || E'\n\n' || v_new_clean_body;
            END IF;

            IF (v_prev_has_disclosure OR v_new_has_disclosure) AND v_combined_text <> '' THEN
                v_combined_text := v_combined_text || E'\n\n' || c_disclosure;
            END IF;
        END IF;

        SELECT COALESCE(jsonb_agg(val ORDER BY min_ord), jsonb_build_array(p_draft_id::text))
        INTO v_draft_ids
        FROM (
            SELECT val, MIN(ord) AS min_ord
            FROM (
                SELECT elem #>> '{}' AS val, ord
                FROM jsonb_array_elements(COALESCE(v_existing_report_content->'draft_ids', '[]'::jsonb)) WITH ORDINALITY AS e(elem, ord)
                UNION ALL
                SELECT v_existing_report_content->>'draft_id', 999998
                WHERE NULLIF(v_existing_report_content->>'draft_id', '') IS NOT NULL
                UNION ALL
                SELECT p_draft_id::text, 999999
            ) raw_ids
            WHERE val IS NOT NULL AND val <> ''
            GROUP BY val
        ) dedup_ids;

        v_req_review := COALESCE((v_existing_report_content->>'requires_staff_review')::boolean, false)
            OR COALESCE((p_report_content->>'requires_staff_review')::boolean, false);

        v_final_content := COALESCE(v_existing_report_content, '{}'::jsonb)
            || jsonb_build_object(
                'text', v_combined_text,
                'draft_id', p_draft_id::text,
                'draft_ids', v_draft_ids,
                'requires_staff_review', v_req_review
            );

        UPDATE public.daily_reports
        SET content = v_final_content,
            status = 'DRAFT',
            updated_at = NOW()
        WHERE id = v_report_id
          AND status <> 'PUBLISHED';
    ELSE
        v_final_content := jsonb_build_object(
            'text', v_new_raw_text,
            'draft_id', p_draft_id,
            'draft_ids', jsonb_build_array(p_draft_id),
            'requires_staff_review', COALESCE((p_report_content->>'requires_staff_review')::boolean, false)
        );

        INSERT INTO public.daily_reports (
            resident_id, author_id, content, status, ai_generated,
            ai_model, ai_prompt_version, ai_generated_at, created_at, updated_at
        ) VALUES (
            p_resident_id, p_nurse_id, v_final_content, 'DRAFT', true,
            p_ai_model, p_ai_prompt_version, v_effective_ts, v_effective_ts, v_effective_ts
        )
        RETURNING id INTO v_report_id;
    END IF;

    PERFORM set_config('sc.voice_auto_merge', '', true);

    -- 4. Aktualizacja voice_draft_notes do PROCESSED
    UPDATE public.voice_draft_notes
    SET status = 'PROCESSED',
        followup_question = NULL,
        updated_at = NOW()
    WHERE id = p_draft_id;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'log_id', v_log_id,
        'report_id', v_report_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.process_voice_draft_atomic FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_voice_draft_atomic TO authenticated;

CREATE OR REPLACE FUNCTION public.review_voice_family_facts(p_segment_id uuid, p_accept boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET log_parameter_max_length_on_error = 0
AS $$
DECLARE
  c_disclosure CONSTANT text := 'Podsumowanie generowane przy wsparciu AI, zatwierdzone przez personel placówki';
  v_org uuid := public.get_jwt_organization_id();
  v_role text := COALESCE(auth.jwt()->'app_metadata'->>'role', '');
  v_prop public.voice_segment_proposals;
  v_day date;
  v_start timestamptz;
  v_end timestamptz;
  v_sources uuid[];
  v_segment_text text;
  v_app_text text;
  v_text text;
  v_report_id uuid;
  v_status text;
  v_fingerprint text;
  v_generated_fingerprint text;
  v_manually_edited boolean := false;
  v_app_entries jsonb := '[]'::jsonb;
  v_existing_content jsonb := '{}'::jsonb;
  v_report_author uuid;
  v_legacy_ai boolean;
  v_legacy_created timestamptz;
  v_legacy_updated timestamptz;
  v_legacy_draft_id text;
  v_legacy_body text;
  v_created_ts timestamptz;
  v_decision text := CASE WHEN p_accept THEN 'ACCEPTED' ELSE 'REJECTED' END;
BEGIN
  PERFORM private.require_report_staff(v_org, ARRAY['nurse','org_admin'], true);
  SELECT * INTO v_prop FROM public.voice_segment_proposals p
    WHERE p.segment_id = p_segment_id AND p.organization_id = v_org
      AND p.resident_id IS NOT NULL AND pg_catalog.cardinality(p.behavioral_facts) > 0
      AND (v_role = 'org_admin' OR p.author_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'VOICE_FAMILY_FACT_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  IF p_accept IS NULL THEN RAISE EXCEPTION 'VOICE_REVIEW_DECISION_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF p_accept AND v_prop.time_state = 'UNKNOWN' THEN
    RAISE EXCEPTION 'VOICE_FAMILY_REPORT_TIME_REQUIRED' USING ERRCODE = '22023';
  END IF;

  v_day := (v_prop.recorded_at AT TIME ZONE 'Europe/Warsaw')::date;
  v_start := v_day::timestamp AT TIME ZONE 'Europe/Warsaw';
  v_end := (v_day + 1)::timestamp AT TIME ZONE 'Europe/Warsaw';
  PERFORM id FROM public.residents WHERE id = v_prop.resident_id AND organization_id = v_org
    AND archived_at IS NULL FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VOICE_FAMILY_RESIDENT_UNAVAILABLE' USING ERRCODE = '42501'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.concat('voice-family/', v_prop.resident_id::text, '/', pg_catalog.to_char(v_day, 'YYYY-MM-DD')), 0)
  );

  SELECT p.family_decision INTO v_prop.family_decision FROM public.voice_segment_proposals p
    WHERE p.segment_id = p_segment_id FOR UPDATE;
  SELECT report_id, last_generated_fingerprint, COALESCE(app_draft_entries, '[]'::jsonb), COALESCE(manually_edited, false)
    INTO v_report_id, v_generated_fingerprint, v_app_entries, v_manually_edited
    FROM public.family_voice_report_provenance
    WHERE resident_id = v_prop.resident_id AND report_day = v_day;
  IF v_prop.family_decision IS NOT NULL THEN
    IF v_prop.family_decision <> v_decision THEN
      RAISE EXCEPTION 'VOICE_FAMILY_FACT_ALREADY_REVIEWED' USING ERRCODE = '23514';
    END IF;
    RETURN CASE WHEN p_accept THEN v_report_id ELSE NULL END;
  END IF;

  IF p_accept AND EXISTS (
    SELECT 1 FROM public.daily_reports d
    WHERE d.resident_id = v_prop.resident_id AND d.status = 'PUBLISHED'
      AND d.created_at >= v_start AND d.created_at < v_end
  ) THEN
    RAISE EXCEPTION 'VOICE_FAMILY_DRAFT_ALREADY_REVIEWED' USING ERRCODE = '23514';
  END IF;

  UPDATE public.voice_segment_proposals SET family_decision = v_decision,
    reviewed_by = auth.uid(), reviewed_at = pg_catalog.now() WHERE segment_id = p_segment_id;
  INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, payload)
    VALUES (v_org, v_prop.resident_id, 'VOICE_FAMILY_FACT_REVIEWED', auth.uid(),
      pg_catalog.jsonb_build_object('segment_id', p_segment_id, 'decision', v_decision));
  IF NOT p_accept THEN RETURN NULL; END IF;

  -- Adopcja istniejącego raportu sprzed migracji (gdy brak jeszcze wpisu w family_voice_report_provenance).
  IF v_report_id IS NULL THEN
    SELECT d.id, d.author_id, d.status, d.ai_generated, COALESCE(d.content, '{}'::jsonb), d.created_at, d.updated_at
      INTO v_report_id, v_report_author, v_status, v_legacy_ai, v_existing_content, v_legacy_created, v_legacy_updated
      FROM public.daily_reports d
      WHERE d.resident_id = v_prop.resident_id
        AND d.created_at >= v_start
        AND d.created_at < v_end
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT 1
      FOR UPDATE;

    IF FOUND THEN
      IF private.is_legacy_daily_report_reviewed(v_status, v_legacy_ai, v_existing_content, v_legacy_created, v_legacy_updated) THEN
        RAISE EXCEPTION 'VOICE_FAMILY_DRAFT_ALREADY_REVIEWED' USING ERRCODE = '23514';
      END IF;

      v_generated_fingerprint := pg_catalog.md5(COALESCE(v_existing_content->>'text', ''));
      v_manually_edited := false;
      v_legacy_draft_id := NULLIF(pg_catalog.btrim(COALESCE(v_existing_content->>'draft_id', '')), '');
      v_legacy_body := pg_catalog.btrim(pg_catalog.replace(COALESCE(v_existing_content->>'text', ''), c_disclosure, ''));
      IF v_legacy_draft_id IS NOT NULL AND v_legacy_body <> '' THEN
        v_app_entries := pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object('draft_id', v_legacy_draft_id, 'author_id', v_report_author, 'body', v_legacy_body)
        );
      END IF;
      IF v_legacy_draft_id IS NOT NULL AND NOT (v_existing_content ? 'draft_ids') THEN
        v_existing_content := v_existing_content || pg_catalog.jsonb_build_object(
          'draft_ids', pg_catalog.jsonb_build_array(v_legacy_draft_id)
        );
      END IF;
    END IF;
  END IF;

  SELECT pg_catalog.array_agg(p.segment_id ORDER BY p.recorded_at, p.segment_id) INTO v_sources
    FROM public.voice_segment_proposals p
    WHERE p.organization_id = v_org AND p.resident_id = v_prop.resident_id
      AND p.time_state <> 'UNKNOWN' AND p.recorded_at >= v_start AND p.recorded_at < v_end
      AND p.family_decision = 'ACCEPTED';

  SELECT pg_catalog.string_agg(fact, E'\n' ORDER BY first_source, first_position) INTO v_segment_text FROM (
    SELECT fact, pg_catalog.min(100000 * p.ord + f.ord) AS first_source, pg_catalog.min(f.ord) AS first_position
    FROM pg_catalog.unnest(v_sources) WITH ORDINALITY p(id, ord)
    JOIN public.voice_segment_proposals s ON s.segment_id = p.id
    CROSS JOIN LATERAL pg_catalog.unnest(s.behavioral_facts) WITH ORDINALITY f(fact, ord)
    GROUP BY fact
  ) dedup;
  PERFORM private.report_required(v_segment_text);

  SELECT pg_catalog.string_agg(pg_catalog.btrim(elem->>'body'), E'\n\n' ORDER BY ord)
    INTO v_app_text
    FROM pg_catalog.jsonb_array_elements(COALESCE(v_app_entries, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
    WHERE NULLIF(pg_catalog.btrim(elem->>'body'), '') IS NOT NULL;

  IF NULLIF(pg_catalog.btrim(v_app_text), '') IS NOT NULL THEN
    v_text := v_app_text || E'\n\n' || v_segment_text;
  ELSE
    v_text := v_segment_text;
  END IF;

  -- AI_DISCLOSURE_LABEL (presentation.contract.mjs). Treść widoczna po publikacji przez personel.
  v_text := v_text || E'\n\n' || c_disclosure;

  PERFORM pg_catalog.set_config('sc.voice_family_facts_merge', 'true', true);

  IF v_report_id IS NULL THEN
    v_created_ts := CASE
      WHEN (pg_catalog.now() AT TIME ZONE 'Europe/Warsaw')::date = v_day THEN pg_catalog.now()
      ELSE v_start + interval '12 hours'
    END;

    INSERT INTO public.daily_reports (
      resident_id, author_id, content, status, ai_generated, ai_model, ai_prompt_version,
      ai_generated_at, created_at, updated_at
    )
    VALUES (
      v_prop.resident_id,
      v_prop.author_id,
      pg_catalog.jsonb_build_object('text', v_text, 'source_segment_ids', pg_catalog.to_jsonb(v_sources)),
      'DRAFT',
      true,
      'rule-based-voice-family-v1',
      'rule-based-voice-family-v1',
      pg_catalog.now(),
      v_created_ts,
      v_created_ts
    )
    RETURNING id INTO v_report_id;
  ELSE
    SELECT d.status, pg_catalog.md5(COALESCE(d.content->>'text', '')), COALESCE(v_existing_content, '{}'::jsonb) || COALESCE(d.content, '{}'::jsonb)
      INTO v_status, v_fingerprint, v_existing_content
      FROM public.daily_reports d
      WHERE d.id = v_report_id
      FOR UPDATE;

    -- Blokada wiersza raportu poprzedza ponowny odczyt znacznika ustawianego przez ręczną edycję.
    SELECT p.manually_edited INTO v_manually_edited
      FROM public.family_voice_report_provenance p WHERE p.report_id = v_report_id;
    IF NOT FOUND THEN
      v_manually_edited := false;
    END IF;
    IF v_manually_edited OR v_status IS DISTINCT FROM 'DRAFT' OR v_fingerprint IS DISTINCT FROM v_generated_fingerprint THEN
      RAISE EXCEPTION 'VOICE_FAMILY_DRAFT_ALREADY_REVIEWED' USING ERRCODE = '23514';
    END IF;

    UPDATE public.daily_reports
      SET content = v_existing_content || pg_catalog.jsonb_build_object('text', v_text, 'source_segment_ids', pg_catalog.to_jsonb(v_sources)),
          updated_at = pg_catalog.now(),
          ai_generated_at = pg_catalog.now()
      WHERE id = v_report_id;
  END IF;

  PERFORM pg_catalog.set_config('sc.voice_family_facts_merge', '', true);

  INSERT INTO public.family_voice_report_provenance
    (resident_id, report_day, report_id, last_generated_fingerprint, source_segment_ids, app_draft_entries, manually_edited)
    VALUES (v_prop.resident_id, v_day, v_report_id, pg_catalog.md5(v_text), v_sources, COALESCE(v_app_entries, '[]'::jsonb), false)
  ON CONFLICT (resident_id, report_day) DO UPDATE
    SET report_id = EXCLUDED.report_id,
        last_generated_fingerprint = EXCLUDED.last_generated_fingerprint,
        source_segment_ids = EXCLUDED.source_segment_ids,
        app_draft_entries = EXCLUDED.app_draft_entries;

  INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, payload)
    VALUES (v_org, v_prop.resident_id, 'VOICE_FAMILY_DRAFT_GENERATED', auth.uid(),
      pg_catalog.jsonb_build_object('report_id', v_report_id, 'segment_ids', v_sources, 'report_day', v_day));
  RETURN v_report_id;
END $$;

REVOKE ALL ON FUNCTION public.review_voice_family_facts(uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_voice_family_facts(uuid,boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
