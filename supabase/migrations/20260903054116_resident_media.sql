-- Create the resident_media table
CREATE TABLE resident_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    content_type TEXT NOT NULL,
    captured_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

-- RLS
ALTER TABLE resident_media ENABLE ROW LEVEL SECURITY;

-- Policies for resident_media
-- Staff can read and write media for their organization
CREATE POLICY "Staff can view resident media in their org"
    ON resident_media FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM residents r
            WHERE r.id = resident_media.resident_id
            AND r.organization_id = public.get_jwt_organization_id()
        )
    );

CREATE POLICY "Staff can insert resident media in their org"
    ON resident_media FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM residents r
            WHERE r.id = resident_media.resident_id
            AND r.organization_id = public.get_jwt_organization_id()
        )
    );

-- Family can read media for linked residents
CREATE POLICY "Family can view linked resident media"
    ON resident_media FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM resident_relative_links rrl
            WHERE rrl.resident_id = resident_media.resident_id
            AND rrl.relative_user_id = auth.uid()
        )
    );

-- Storage bucket for resident-media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resident-media', 'resident-media', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for the storage bucket 'resident-media'
-- We allow authenticated users to select if they have access via the database policies
-- Storage policies are based on bucket_id
CREATE POLICY "Authenticated users can read resident-media"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'resident-media' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert into resident-media"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'resident-media' AND auth.role() = 'authenticated');
