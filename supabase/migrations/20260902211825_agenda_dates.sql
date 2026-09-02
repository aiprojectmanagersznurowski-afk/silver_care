ALTER TABLE public.agenda_items ADD COLUMN target_date date;

-- Update existing data
UPDATE public.agenda_items 
SET target_date = CURRENT_DATE 
WHERE is_template = false;

-- The 'is_template = true' ones remain target_date = NULL, which means they are recurring every day.

-- We don't necessarily drop 'is_template' column right now to avoid breaking running clients during deployment,
-- but we will stop using it. 
