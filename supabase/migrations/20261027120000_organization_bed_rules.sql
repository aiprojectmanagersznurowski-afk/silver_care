-- ADM-BED-ASSIGNMENT: Ustawienia reguł przydziału łóżek w placówce (zapis w bazie danych, nie w ciasteczkach)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.organizations.settings IS 'Konfiguracja placówki, w tym reguły asystenta przydziału łóżek (bed_allocation_rules).';
