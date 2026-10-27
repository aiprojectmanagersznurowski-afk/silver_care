-- FAM-AGENDA-NO-MEDICAL (decyzja Michała 2026-10-26): plan dnia widoczny dla bliskich bez treści medycznych.
-- Strumień MEDICAL nie trafia do rodziny — także przez plan dnia. Egzekwowanie w bazie, nie tylko w interfejsie.
--
-- Słowa = contracts/presentation.contract.mjs AGENDA_FAMILY_EXCLUSION (te same co lib/agenda-family-visibility.ts).
-- Zgodność pilnuje tests/db/agenda_family_no_medical.test.ts (każde słowo z kontraktu musi być rozpoznane).
-- Wyraz pasuje, gdy zaczyna się od rdzenia: przed nim początek tekstu albo znak niebędący literą.

CREATE OR REPLACE FUNCTION public.is_medical_agenda_item(p_title text, p_type text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT lower(coalesce(p_type, '')) = ANY (ARRAY['medication'])
      OR lower(coalesce(p_title, '')) ~ '(^|[^a-ząćęłńóśźż0-9])(leki|leków|lekami|lekarstw|dawk|tabletk|kapsułk|kropl|zastrzyk|iniekcj|insulin|antybiotyk|syrop|inhalacj|maści|diagnoz|rozpoznani|chorob|infekcj|gorączk|badani|pobrani|morfologi|rtg|usg|tomograf|ciśnieni|cukru|cukier|glukoz|glikemi|ekg|saturacj|tętn|pomiar|lekarz|lekarsk|zabieg|konsultacj|zaleceni|opatrun)';
$function$;

ALTER TABLE public.agenda_items
  ADD COLUMN IF NOT EXISTS family_visible boolean NOT NULL DEFAULT true;

-- Wartość zawsze z reguły — także gdy klient spróbuje ustawić ją sam
CREATE OR REPLACE FUNCTION public.set_agenda_family_visible()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.family_visible := NOT public.is_medical_agenda_item(NEW.title, NEW.type);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS agenda_items_family_visible ON public.agenda_items;
CREATE TRIGGER agenda_items_family_visible
  BEFORE INSERT OR UPDATE ON public.agenda_items
  FOR EACH ROW EXECUTE FUNCTION public.set_agenda_family_visible();

-- Przeliczenie istniejących wpisów
UPDATE public.agenda_items
SET family_visible = NOT public.is_medical_agenda_item(title, type);

-- Polityka rodziny: jak dotąd + tylko pozycje bez treści medycznej
DROP POLICY IF EXISTS "agenda_items_family_select" ON public.agenda_items;
CREATE POLICY "agenda_items_family_select" ON public.agenda_items
  FOR SELECT
  USING (
    organization_id = public.get_jwt_organization_id() AND
    COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '') IN ('family', 'legal_guardian') AND
    family_visible AND
    (
      resident_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.resident_relative_links
        WHERE resident_relative_links.resident_id = agenda_items.resident_id
        AND resident_relative_links.relative_user_id = auth.uid()
      )
    )
  );
