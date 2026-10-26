-- Sektor bez przedrostka „Sektor” (decyzja Michała 2026-10-26).
-- Aplikacja pokazuje nazwę sektora tak, jak ją nazwano, i usuwa przedrostek przy zapisie (lib/sector.ts).
-- Tu porządkujemy dane zapisane wcześniej: „Sektor A” → „A”, „sektor: Północ” → „Północ”, samo „Sektor” → NULL.
-- Słowa zaczynające się od „sektor…” (np. „Sektorowe skrzydło”) zostają bez zmian.
-- @REQ: ADM-FACILITY-MANAGE

UPDATE public.rooms
SET sector = NULLIF(btrim(regexp_replace(sector, '^\s*sektor\s*[:\-–]?\s*', '', 'i')), '')
WHERE sector ~* '^\s*sektor(\s|:|-|–|$)';
