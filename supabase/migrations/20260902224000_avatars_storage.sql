-- Migration: 20260902224000_avatars_storage.sql

-- 1. Tworzenie bucketu 'avatars'
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Konfiguracja polityk dostępu RLS dla storage.objects w kontekście nowej gałęzi
-- Odczyt: dostęp publiczny (aby avatary ładowały się na froncie z URL-a)
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'avatars' );

-- Zapis/Upload: Tylko dla uwierzytelnionych użytkowników
CREATE POLICY "Authenticated users can upload avatars" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- Aktualizacja/Nadpisywanie
CREATE POLICY "Authenticated users can update avatars" 
ON storage.objects FOR UPDATE 
WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- Usuwanie
CREATE POLICY "Authenticated users can delete avatars" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- 3. Rozbudowa tabeli residents o pole avatar_url
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS avatar_url TEXT;
