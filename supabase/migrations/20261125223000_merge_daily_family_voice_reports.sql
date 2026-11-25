-- @REQ: REPORT-APPROVAL
-- @REQ: VOICE-DOCK-REPORTS
-- @REQ: VOICE-RESIDENT-ASSIGN
-- @REQ: VOICE-DRAFT-ISOLATION
--
-- Wspólny szkic dobowy daily_reports per (resident_id, report_day w strefie Europe/Warsaw)
-- dla nagrań ogólnych (review_voice_family_facts) oraz notatek o podopiecznym (process_voice_draft_atomic),
-- z zachowaniem RLS nurse:own, blokady nadpisania PUBLISHED oraz ochrony ręcznej edycji szkicu.

ALTER TABLE public.family_voice_report_provenance
  ALTER COLUMN source_segment_ids SET DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS app_draft_entries jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION private.sync_app_voice_family_provenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET log_parameter_max_length_on_error = 0
AS $$
DECLARE
  v_day date;
  v_draft_id text;
  v_draft_body text;
  v_fingerprint text;
  v_prev_report_id uuid;
  v_prev_entries jsonb;
  v_prev_status text;
  v_updated_entries jsonb;
BEGIN
  IF pg_catalog.current_setting('sc.voice_auto_merge', true) IS DISTINCT FROM 'true'
     OR NEW.status IS DISTINCT FROM 'DRAFT' THEN
    RETURN NEW;
  END IF;

  v_day := (NEW.created_at AT TIME ZONE 'Europe/Warsaw')::date;
  v_draft_id := NULLIF(pg_catalog.btrim(COALESCE(pg_catalog.current_setting('sc.voice_current_draft_id', true), '')), '');
  v_draft_body := pg_catalog.btrim(COALESCE(pg_catalog.current_setting('sc.voice_current_draft_body', true), ''));
  v_fingerprint := pg_catalog.md5(COALESCE(NEW.content->>'text', ''));

  SELECT p.report_id, p.app_draft_entries
    INTO v_prev_report_id, v_prev_entries
    FROM public.family_voice_report_provenance p
    WHERE p.resident_id = NEW.resident_id
      AND p.report_day = v_day
    FOR UPDATE;

  IF NOT FOUND THEN
    v_updated_entries := CASE
      WHEN v_draft_id IS NOT NULL AND v_draft_body <> '' THEN
        pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('draft_id', v_draft_id, 'body', v_draft_body))
      ELSE '[]'::jsonb
    END;

    INSERT INTO public.family_voice_report_provenance
      (resident_id, report_day, report_id, last_generated_fingerprint, source_segment_ids, app_draft_entries)
    VALUES
      (NEW.resident_id, v_day, NEW.id, v_fingerprint, '{}'::uuid[], v_updated_entries);

    RETURN NEW;
  END IF;

  IF v_prev_report_id = NEW.id THEN
    SELECT COALESCE(pg_catalog.jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
      INTO v_updated_entries
      FROM pg_catalog.jsonb_array_elements(COALESCE(v_prev_entries, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
      WHERE elem->>'draft_id' IS DISTINCT FROM v_draft_id;

    IF v_draft_id IS NOT NULL AND v_draft_body <> '' THEN
      v_updated_entries := v_updated_entries || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('draft_id', v_draft_id, 'body', v_draft_body)
      );
    END IF;

    UPDATE public.family_voice_report_provenance
      SET last_generated_fingerprint = v_fingerprint,
          app_draft_entries = v_updated_entries
      WHERE resident_id = NEW.resident_id
        AND report_day = v_day;

    RETURN NEW;
  END IF;

  -- Jeżeli poprzedni raport z tego dnia został już opublikowany (lub usunięty),
  -- nowy szkic przejmuje śledzenie provenance na bieżący dzień.
  SELECT d.status INTO v_prev_status
    FROM public.daily_reports d
    WHERE d.id = v_prev_report_id;

  IF v_prev_status IS DISTINCT FROM 'DRAFT' THEN
    v_updated_entries := CASE
      WHEN v_draft_id IS NOT NULL AND v_draft_body <> '' THEN
        pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('draft_id', v_draft_id, 'body', v_draft_body))
      ELSE '[]'::jsonb
    END;

    UPDATE public.family_voice_report_provenance
      SET report_id = NEW.id,
          last_generated_fingerprint = v_fingerprint,
          source_segment_ids = '{}'::uuid[],
          app_draft_entries = v_updated_entries
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
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    c_disclosure CONSTANT TEXT := 'Podsumowanie generowane przy wsparciu AI, zatwierdzone przez personel placówki';
    v_caller_uid UUID;
    v_caller_role TEXT;
    v_jwt_org_id UUID;
    v_effective_org_id UUID;
    v_draft_status TEXT;
    v_draft_resident_id UUID;
    v_draft_org_id UUID;
    v_existing_report_id UUID;
    v_existing_report_status TEXT;
    v_existing_report_content JSONB;
    v_log_id UUID;
    v_report_id UUID;
    v_report_day DATE;
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

    -- 1. Sprawdź istnienie szkicu, zgodność resident_id oraz organization_id
    SELECT vdn.status, vdn.resident_id, r.organization_id
    INTO v_draft_status, v_draft_resident_id, v_draft_org_id
    FROM public.voice_draft_notes vdn
    JOIN public.residents r ON r.id = vdn.resident_id
    WHERE vdn.id = p_draft_id;

    IF v_draft_status IS NULL
       OR v_draft_resident_id IS DISTINCT FROM p_resident_id
       OR v_draft_org_id IS DISTINCT FROM v_effective_org_id THEN
        RAISE EXCEPTION 'Draft resident/organization mismatch' USING ERRCODE = '42501';
    END IF;

    -- Idempotencja dla już przetworzonego szkicu
    IF v_draft_status = 'PROCESSED' THEN
        SELECT id, content INTO v_existing_report_id, v_existing_report_content
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

    -- 2. Zapis / aktualizacja daily_logs (dane medyczne dla personelu)
    SELECT id INTO v_log_id
    FROM public.daily_logs
    WHERE resident_id = p_resident_id
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

    -- 3A. Sprawdź, czy ten konkretny p_draft_id jest już przypisany do raportu (blokada nadpisania PUBLISHED)
    SELECT id, status, content
    INTO v_report_id, v_existing_report_status, v_existing_report_content
    FROM public.daily_reports
    WHERE resident_id = p_resident_id
      AND (
        content @> jsonb_build_object('draft_id', p_draft_id::text)
        OR content @> jsonb_build_object('draft_ids', jsonb_build_array(p_draft_id::text))
      )
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_report_id IS NOT NULL AND v_existing_report_status = 'PUBLISHED' THEN
        RAISE EXCEPTION 'Cannot overwrite published daily report' USING ERRCODE = '42501';
    END IF;

    -- 3B. Jeśli brak raportu dla tego p_draft_id, poszukaj dzisiejszego szkicu DRAFT tego podopiecznego (wspólny szkic dnia)
    IF v_report_id IS NULL THEN
        v_report_day := (COALESCE(p_ai_generated_at, NOW()) AT TIME ZONE 'Europe/Warsaw')::date;
        SELECT id, status, content
        INTO v_report_id, v_existing_report_status, v_existing_report_content
        FROM public.daily_reports
        WHERE resident_id = p_resident_id
          AND author_id = p_nurse_id
          AND status = 'DRAFT'
          AND (created_at AT TIME ZONE 'Europe/Warsaw')::date = v_report_day
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE;
    END IF;

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
            || p_report_content
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
        v_final_content := p_report_content || jsonb_build_object(
            'draft_ids', jsonb_build_array(p_draft_id::text)
        );

        INSERT INTO public.daily_reports (
            resident_id, author_id, content, status, ai_generated,
            ai_model, ai_prompt_version, ai_generated_at, created_at, updated_at
        ) VALUES (
            p_resident_id, p_nurse_id, v_final_content, 'DRAFT', true,
            p_ai_model, p_ai_prompt_version, p_ai_generated_at, NOW(), NOW()
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

REVOKE ALL ON FUNCTION public.process_voice_draft_atomic FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_voice_draft_atomic FROM anon;
GRANT EXECUTE ON FUNCTION public.process_voice_draft_atomic TO authenticated;

CREATE OR REPLACE FUNCTION public.review_voice_family_facts(p_segment_id uuid, p_accept boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET log_parameter_max_length_on_error = 0
AS $$
DECLARE
  v_org uuid := public.get_jwt_organization_id();
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
  v_app_entries jsonb := '[]'::jsonb;
  v_existing_content jsonb := '{}'::jsonb;
  v_decision text := CASE WHEN p_accept THEN 'ACCEPTED' ELSE 'REJECTED' END;
BEGIN
  PERFORM private.require_report_staff(v_org, ARRAY['nurse','org_admin'], true);
  SELECT * INTO v_prop FROM public.voice_segment_proposals p
    WHERE p.segment_id = p_segment_id AND p.organization_id = v_org
      AND p.resident_id IS NOT NULL AND pg_catalog.cardinality(p.behavioral_facts) > 0
      AND (auth.jwt()->'app_metadata'->>'role' = 'org_admin' OR p.author_id = auth.uid());
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
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.concat('voice-family/', v_prop.resident_id, '/', v_day), 0));

  SELECT p.family_decision INTO v_prop.family_decision FROM public.voice_segment_proposals p
    WHERE p.segment_id = p_segment_id FOR UPDATE;
  SELECT report_id, last_generated_fingerprint, COALESCE(app_draft_entries, '[]'::jsonb)
    INTO v_report_id, v_generated_fingerprint, v_app_entries
    FROM public.family_voice_report_provenance
    WHERE resident_id = v_prop.resident_id AND report_day = v_day;
  IF v_prop.family_decision IS NOT NULL THEN
    IF v_prop.family_decision <> v_decision THEN
      RAISE EXCEPTION 'VOICE_FAMILY_FACT_ALREADY_REVIEWED' USING ERRCODE = '23514';
    END IF;
    RETURN CASE WHEN p_accept THEN v_report_id ELSE NULL END;
  END IF;

  UPDATE public.voice_segment_proposals SET family_decision = v_decision,
    reviewed_by = auth.uid(), reviewed_at = pg_catalog.now() WHERE segment_id = p_segment_id;
  INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, payload)
    VALUES (v_org, v_prop.resident_id, 'VOICE_FAMILY_FACT_REVIEWED', auth.uid(),
      pg_catalog.jsonb_build_object('segment_id', p_segment_id, 'decision', v_decision));
  IF NOT p_accept THEN RETURN NULL; END IF;

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
  v_text := v_text || E'\n\nPodsumowanie generowane przy wsparciu AI, zatwierdzone przez personel placówki';

  IF v_report_id IS NULL THEN
    INSERT INTO public.daily_reports (resident_id, author_id, content, status, ai_generated, ai_model, ai_prompt_version)
    VALUES (
      v_prop.resident_id,
      v_prop.author_id,
      pg_catalog.jsonb_build_object('text', v_text, 'source_segment_ids', pg_catalog.to_jsonb(v_sources)),
      'DRAFT',
      true,
      'rule-based-voice-family-v1',
      'rule-based-voice-family-v1'
    )
    RETURNING id INTO v_report_id;
  ELSE
    SELECT status, pg_catalog.md5(content->>'text'), COALESCE(content, '{}'::jsonb)
      INTO v_status, v_fingerprint, v_existing_content
      FROM public.daily_reports
      WHERE id = v_report_id FOR UPDATE;
    IF v_status IS DISTINCT FROM 'DRAFT' OR v_fingerprint IS DISTINCT FROM v_generated_fingerprint THEN
      RAISE EXCEPTION 'VOICE_FAMILY_DRAFT_ALREADY_REVIEWED' USING ERRCODE = '23514';
    END IF;
    UPDATE public.daily_reports
      SET content = v_existing_content || pg_catalog.jsonb_build_object('text', v_text, 'source_segment_ids', pg_catalog.to_jsonb(v_sources)),
          updated_at = pg_catalog.now(),
          ai_generated_at = pg_catalog.now()
      WHERE id = v_report_id;
  END IF;

  INSERT INTO public.family_voice_report_provenance
    (resident_id, report_day, report_id, last_generated_fingerprint, source_segment_ids, app_draft_entries)
    VALUES (v_prop.resident_id, v_day, v_report_id, pg_catalog.md5(v_text), v_sources, COALESCE(v_app_entries, '[]'::jsonb))
  ON CONFLICT (resident_id, report_day) DO UPDATE
    SET report_id = EXCLUDED.report_id,
        last_generated_fingerprint = EXCLUDED.last_generated_fingerprint,
        source_segment_ids = EXCLUDED.source_segment_ids;

  INSERT INTO public.audit_logs (organization_id, resident_id, action, performed_by, payload)
    VALUES (v_org, v_prop.resident_id, 'VOICE_FAMILY_DRAFT_GENERATED', auth.uid(),
      pg_catalog.jsonb_build_object('report_id', v_report_id, 'segment_ids', v_sources, 'report_day', v_day));
  RETURN v_report_id;
END $$;

REVOKE ALL ON FUNCTION public.review_voice_family_facts(uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_voice_family_facts(uuid,boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
