-- Migration: 20261117140000_avatars_write_admins_only.sql
-- @REQ: ORG-ISOLATION
--
-- Doraźne uszczelnienie publicznego bucketu `avatars` (decyzja Michała 2026-11-17, WO-ADM-RESIDENT-PHOTO):
-- dotąd INSERT / UPDATE / DELETE miał KAŻDY zalogowany (także rodzina i pielęgniarka), więc mógł podmienić
-- albo usunąć dowolne zdjęcie. Zapis zostaje wyłącznie dla kierownika placówki i super admina
-- (zaproszenie personelu ze zdjęciem). Odczyt publiczny bez zmian do czasu przeniesienia zdjęć podopiecznych
-- do prywatnego `resident-photos` (WO kroki 5–6).

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete avatars" ON storage.objects;

CREATE POLICY "avatars_admins_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') IN ('org_admin', 'super_admin')
  );

CREATE POLICY "avatars_admins_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') IN ('org_admin', 'super_admin')
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') IN ('org_admin', 'super_admin')
  );

CREATE POLICY "avatars_admins_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') IN ('org_admin', 'super_admin')
  );
