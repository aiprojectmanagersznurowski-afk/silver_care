-- Migration: 20261015220000_atomic_voice_process_rpc.sql
-- Procedura RPC dla atomowego zapisu przetwarzania notatki głosowej (daily_logs + daily_reports + voice_draft_notes).
-- Hardening: SECURITY INVOKER, SET search_path = public, weryfikacja auth.uid(), roli JWT, izolacji organizacji oraz blokada nadpisania PUBLISHED.

-- Rozszerzenie polityk SELECT/UPDATE na daily_logs i daily_reports dla ról personelu przy SECURITY INVOKER
DROP POLICY IF EXISTS "Nurse can read own daily logs" ON public.daily_logs;
DROP POLICY IF EXISTS "Staff can read own daily logs" ON public.daily_logs;
CREATE POLICY "Staff can read own daily logs"
    ON public.daily_logs FOR SELECT TO authenticated
    USING (
        ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('nurse', 'paramedic', 'caregiver', 'org_admin', 'super_admin', 'admin'))
        AND (
            nurse_id = auth.uid()
            OR ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('super_admin', 'org_admin', 'admin'))
        )
    );

DROP POLICY IF EXISTS "Nurse can update own daily logs" ON public.daily_logs;
DROP POLICY IF EXISTS "Staff can update own daily logs" ON public.daily_logs;
CREATE POLICY "Staff can update own daily logs"
    ON public.daily_logs FOR UPDATE TO authenticated
    USING (
        ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('nurse', 'paramedic', 'caregiver', 'org_admin', 'super_admin', 'admin'))
        AND (
            nurse_id = auth.uid()
            OR ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('super_admin', 'org_admin', 'admin'))
        )
    );

DROP POLICY IF EXISTS "Nurse can read own daily reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Staff can read own daily reports" ON public.daily_reports;
CREATE POLICY "Staff can read own daily reports"
    ON public.daily_reports FOR SELECT TO authenticated
    USING (
        ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('nurse', 'paramedic', 'caregiver', 'org_admin', 'super_admin', 'admin'))
        AND (
            author_id = auth.uid()
            OR ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('super_admin', 'org_admin', 'admin'))
        )
    );

DROP POLICY IF EXISTS "Nurse can update own daily reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Staff can update own daily reports" ON public.daily_reports;
CREATE POLICY "Staff can update own daily reports"
    ON public.daily_reports FOR UPDATE TO authenticated
    USING (
        ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('nurse', 'paramedic', 'caregiver', 'org_admin', 'super_admin', 'admin'))
        AND (
            author_id = auth.uid()
            OR ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('super_admin', 'org_admin', 'admin'))
        )
    );

DROP FUNCTION IF EXISTS public.process_voice_draft_atomic(UUID, UUID, UUID, JSONB, JSONB, TEXT, TEXT, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS public.process_voice_draft_atomic(UUID, UUID, UUID, JSONB, JSONB, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, UUID);

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
    v_caller_uid UUID;
    v_caller_role TEXT;
    v_jwt_org_id UUID;
    v_effective_org_id UUID;
    v_draft_status TEXT;
    v_draft_resident_id UUID;
    v_draft_org_id UUID;
    v_existing_report_id UUID;
    v_existing_report_status TEXT;
    v_log_id UUID;
    v_report_id UUID;
    v_existing_report_content JSONB;
BEGIN
    -- 0A. Weryfikacja tożsamości wywołującego (auth.uid())
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized caller: nurse_id must match auth.uid()' USING ERRCODE = '42501';
    END IF;

    -- 0B. Weryfikacja roli z JWT (wyłącznie personel/admin; blokada family i legal_guardian)
    v_caller_role := COALESCE(
        NULLIF(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'role',
        ''
    );
    IF v_caller_role IN ('family', 'legal_guardian')
       OR v_caller_role NOT IN ('nurse', 'caregiver', 'paramedic', 'org_admin', 'super_admin', 'admin') THEN
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

    -- Jeśli już przetworzone, pobierz istniejący raport (idempotencja)
    IF v_draft_status = 'PROCESSED' THEN
        SELECT id, content INTO v_existing_report_id, v_existing_report_content
        FROM public.daily_reports
        WHERE resident_id = p_resident_id
          AND content @> jsonb_build_object('draft_id', p_draft_id::text)
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

    -- 3. Zapis / aktualizacja daily_reports (szkic dla bliskich — bez możliwości nadpisania PUBLISHED)
    SELECT id, status INTO v_report_id, v_existing_report_status
    FROM public.daily_reports
    WHERE resident_id = p_resident_id
      AND content @> jsonb_build_object('draft_id', p_draft_id::text)
    LIMIT 1;

    IF v_report_id IS NOT NULL THEN
        IF v_existing_report_status = 'PUBLISHED' THEN
            RAISE EXCEPTION 'Cannot overwrite published daily report' USING ERRCODE = '42501';
        END IF;

        UPDATE public.daily_reports
        SET content = p_report_content,
            status = 'DRAFT',
            updated_at = NOW()
        WHERE id = v_report_id
          AND status <> 'PUBLISHED';
    ELSE
        INSERT INTO public.daily_reports (
            resident_id, author_id, content, status, ai_generated,
            ai_model, ai_prompt_version, ai_generated_at, created_at, updated_at
        ) VALUES (
            p_resident_id, p_nurse_id, p_report_content, 'DRAFT', true,
            p_ai_model, p_ai_prompt_version, p_ai_generated_at, NOW(), NOW()
        )
        RETURNING id INTO v_report_id;
    END IF;

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

COMMENT ON FUNCTION public.process_voice_draft_atomic IS 'Atomowa transakcja zapisu logów personelu, raportu dla rodziny oraz finalizacji statusu szkicu głosu (SECURITY INVOKER + RLS).';
