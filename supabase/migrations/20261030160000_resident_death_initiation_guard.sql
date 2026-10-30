-- ADM-BED-ASSIGNMENT, ADM-ARCHIVE: Zabezpieczenie operacyjnego zgłoszenia zgonu pensjonariusza
-- 1. Dodanie kolumny death_reported_at do tabeli residents
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS death_reported_at timestamptz;

-- 2. Rozszerzenie dozwolonych typów zdarzeń w resident_events o 'death_reported'
ALTER TABLE public.resident_events
  DROP CONSTRAINT IF EXISTS resident_events_event_type_check;

ALTER TABLE public.resident_events
  ADD CONSTRAINT resident_events_event_type_check CHECK (event_type IN (
    'contract_signed',
    'contract_ended',
    'death',
    'death_reported',
    'care_level_changed',
    'admission',
    'bed_transfer',
    'package_added',
    'package_removed'
  ));

-- 3. RLS resident_events: personel (nurse) może rejestrować zdarzenie death_reported
DROP POLICY IF EXISTS "resident_events_insert" ON public.resident_events;
CREATE POLICY "resident_events_insert" ON public.resident_events
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_jwt_organization_id()
    AND (
      COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = ANY (ARRAY['org_admin', 'super_admin'])
      OR (
        COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = 'nurse'
        AND event_type = 'death_reported'
      )
    )
  );

-- 4. Ochrona widoczności zadań w planie dnia (agenda_items):
-- Zadania staff_only/internal oraz pozycje jawnie oznaczone jako family_visible = false NIE mogą zostać nadpisane na true
CREATE OR REPLACE FUNCTION public.set_agenda_family_visible()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.family_visible IS FALSE OR lower(coalesce(NEW.type, '')) IN ('staff_only', 'internal') THEN
    NEW.family_visible := false;
  ELSE
    NEW.family_visible := NOT public.is_medical_agenda_item(NEW.title, NEW.type);
  END IF;
  RETURN NEW;
END;
$function$;
