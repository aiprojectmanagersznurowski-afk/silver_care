-- Migration: 20261011215000_single_primary_contact.sql
-- Dodanie kolumny is_primary_contact oraz automatyczne pilnowanie pojedynczego kontaktu głównego per podopieczny (SC-ADM-03 AC3).

ALTER TABLE public.resident_relative_links
  ADD COLUMN IF NOT EXISTS is_primary_contact boolean NOT NULL DEFAULT false;

-- Funkcja wyzwalacza: ustawienie is_primary_contact = true zdejmuje flagę ze wszystkich pozostałych kontaktów tego pensjonariusza
CREATE OR REPLACE FUNCTION public.handle_single_primary_contact()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_primary_contact = true THEN
    UPDATE public.resident_relative_links
    SET is_primary_contact = false
    WHERE resident_id = NEW.resident_id
      AND id != NEW.id
      AND is_primary_contact = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_single_primary_contact ON public.resident_relative_links;

CREATE TRIGGER trg_single_primary_contact
BEFORE INSERT OR UPDATE OF is_primary_contact ON public.resident_relative_links
FOR EACH ROW
WHEN (NEW.is_primary_contact = true)
EXECUTE FUNCTION public.handle_single_primary_contact();

-- Indeks cząstkowy unikalności gwarantujący, że po transakcji zawsze istnieje maksymalnie jeden kontakt główny dla danego seniora
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_primary_relative_per_resident
  ON public.resident_relative_links (resident_id)
  WHERE (is_primary_contact = true);
