-- Migration: 20260925100000_resident_contract_document.sql
-- REQ: ADM-RESIDENT-ADD
-- Dodanie kolumn dla załącznika umowy w karcie podopiecznego

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS contract_document_path text,
  ADD COLUMN IF NOT EXISTS contract_document_name text;

COMMENT ON COLUMN public.residents.contract_document_path IS 'Ścieżka do pliku skanu/podpisanej umowy w Supabase Storage (bucket resident-media)';
COMMENT ON COLUMN public.residents.contract_document_name IS 'Oryginalna nazwa pliku załącznika umowy';
