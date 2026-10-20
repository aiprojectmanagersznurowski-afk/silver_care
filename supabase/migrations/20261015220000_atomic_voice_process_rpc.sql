-- Migration: 20261015220000_atomic_voice_process_rpc.sql
-- Procedura RPC dla atomowego zapisu przetwarzania notatki głosowej (daily_logs + daily_reports + voice_draft_notes).

CREATE OR REPLACE FUNCTION public.process_voice_draft_atomic(
    p_draft_id UUID,
    p_resident_id UUID,
    p_nurse_id UUID,
    p_daily_log_data JSONB,
    p_report_content JSONB,
    p_ai_model TEXT DEFAULT NULL,
    p_ai_prompt_version TEXT DEFAULT NULL,
    p_ai_generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_draft_status TEXT;
    v_existing_report_id UUID;
    v_log_id UUID;
    v_report_id UUID;
    v_existing_report_content JSONB;
BEGIN
    -- 1. Sprawdź status szkicu (idempotencja)
    SELECT status INTO v_draft_status
    FROM public.voice_draft_notes
    WHERE id = p_draft_id;

    IF v_draft_status IS NULL THEN
        RAISE EXCEPTION 'Voice draft note not found: %', p_draft_id;
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

    -- 3. Zapis / aktualizacja daily_reports (szkic dla bliskich)
    SELECT id INTO v_report_id
    FROM public.daily_reports
    WHERE resident_id = p_resident_id
      AND content @> jsonb_build_object('draft_id', p_draft_id::text)
    LIMIT 1;

    IF v_report_id IS NOT NULL THEN
        UPDATE public.daily_reports
        SET content = p_report_content,
            status = 'DRAFT',
            updated_at = NOW()
        WHERE id = v_report_id;
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

COMMENT ON FUNCTION public.process_voice_draft_atomic IS 'Atomowa transakcja zapisu logów personelu, raportu dla rodziny oraz finalizacji statusu szkicu głosu.';
