-- voice_draft_notes table

CREATE TABLE IF NOT EXISTS public.voice_draft_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
    nurse_id UUID NOT NULL, -- references auth.users(id), but we usually don't enforce foreign key to auth in RLS-only setups or we do if preferred. We'll leave it as UUID.
    audio_url TEXT NOT NULL,
    transcript TEXT,
    status TEXT DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.voice_draft_notes ENABLE ROW LEVEL SECURITY;

-- Nurse can create a note
CREATE POLICY "Nurse can create voice draft note"
    ON public.voice_draft_notes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'nurse'
    );

-- Nurse can read own note
CREATE POLICY "Nurse can read own voice draft note"
    ON public.voice_draft_notes
    FOR SELECT
    TO authenticated
    USING (
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'nurse'
        AND nurse_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
    );

-- Nurse can update own note
CREATE POLICY "Nurse can update own voice draft note"
    ON public.voice_draft_notes
    FOR UPDATE
    TO authenticated
    USING (
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'nurse'
        AND nurse_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
    );

-- Nurse can delete own note
CREATE POLICY "Nurse can delete own voice draft note"
    ON public.voice_draft_notes
    FOR DELETE
    TO authenticated
    USING (
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'nurse'
        AND nurse_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
    );

-- Restrictive policy for MFA (AAL2) inherited from global rule is already covering all tables?
-- Wait, the `20260829060000_security_mfa.sql` applied the RESTRICTIVE policy to:
-- residents, organizations, beds, bed_assignments, consent_ledger, resident_relative_links
-- We should also apply it to voice_draft_notes!
CREATE POLICY "Enforce MFA for staff on voice_draft_notes"
    ON public.voice_draft_notes
    AS RESTRICTIVE
    TO authenticated
    USING ( public.check_mfa_requirement() );

-- VOICE-RETENTION: retention of 30 days
-- We will create a function that deletes old drafts, which could be invoked via pg_cron.
CREATE OR REPLACE FUNCTION public.cleanup_voice_drafts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.voice_draft_notes
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- We could use pg_cron if available:
-- SELECT cron.schedule('cleanup-voice-drafts', '0 2 * * *', 'SELECT public.cleanup_voice_drafts()');
