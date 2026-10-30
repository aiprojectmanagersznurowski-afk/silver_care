-- ADM-CAPACITY-LIMIT (SC-ADM-22, CAPACITY_POLICY.onExceed.notify = ['A4', 'A5']):
-- zatwierdzone przekroczenie limitu miejsc (wpis ORGANIZATION_CAPACITY_EXCEEDED w audit_logs)
-- zakłada w kolejce dwa powiadomienia: A4 do kierownika placówki i A5 do super admina.
-- Jeden punkt dla wszystkich ścieżek (łóżko, import struktury, przyjęcie, import podopiecznych).
-- Payload zawiera wyłącznie liczby i rodzaj operacji — bez danych osobowych (NTF-NO-PII).

CREATE OR REPLACE FUNCTION public.enqueue_capacity_exceeded_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_facts jsonb := jsonb_build_object(
    'operation', NEW.payload->>'operation',
    'counts', NEW.payload->>'counts',
    'resident_limit', (NEW.payload->>'resident_limit')::int,
    'projected_count', (NEW.payload->>'projected_count')::int,
    'excess', (NEW.payload->>'excess')::int
  );
BEGIN
  INSERT INTO public.outbox_notifications (organization_id, entity_type, entity_id, payload)
  VALUES
    (NEW.organization_id, 'capacity_exceeded', NEW.organization_id, v_facts || '{"notification_id": "A4"}'::jsonb),
    (NEW.organization_id, 'capacity_exceeded', NEW.organization_id, v_facts || '{"notification_id": "A5"}'::jsonb);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS audit_logs_capacity_exceeded_outbox ON public.audit_logs;
CREATE TRIGGER audit_logs_capacity_exceeded_outbox
  AFTER INSERT ON public.audit_logs
  FOR EACH ROW
  WHEN (NEW.action = 'ORGANIZATION_CAPACITY_EXCEEDED' AND NEW.organization_id IS NOT NULL)
  EXECUTE FUNCTION public.enqueue_capacity_exceeded_notifications();
