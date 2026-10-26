-- Migration: 20261024130000_search_unaccent_columns.sql
-- @REQ: UI-TEMPLATE-ALIGNMENT, ORG-ISOLATION
--
-- Wyszukiwanie bez polskich znaków (np. „zolw” znajduje „Żółw”, „lodz” znajduje „Łódź”).
-- ILIKE rozróżnia znaki diakrytyczne, więc dodajemy kolumny pomocnicze GENERATED ALWAYS … STORED:
-- małe litery bez diakrytyków, wyliczane z nazw. Dzięki temu nie ma osobnej kopii do synchronizacji
-- (zmiana nazwiska, także anonimizacja, przelicza kolumnę sama), a kolumna podlega tym samym politykom RLS
-- co reszta wiersza. Aplikacja normalizuje frazę w ten sam sposób i porównuje ją z kolumną pomocniczą.
--
--   residents.search_name        = imię + nazwisko
--   organizations.search_name    = nazwa placówki
--   agenda_items.search_title    = tytuł zadania
--
-- Indeksów nie dodajemy: tabele mają rząd setek wierszy na placówkę, a skan sekwencyjny po organization_id
-- trwa milisekundy. Gdyby dane urosły, kolumny nadają się pod indeks GIN (pg_trgm), osobną migracją po pomiarze.
--
-- Koszt: trzy kolumny tekstowe (kopia nazw, to samo wrażliwe dane co w wierszu; kasowane razem z wierszem),
-- jednorazowe przepisanie trzech małych tabel przy dodaniu kolumn (krótka blokada ACCESS EXCLUSIVE).
--
-- WYMAGANA KOLEJNOŚĆ WDROŻENIA: najpierw ta migracja, dopiero potem kod aplikacji używający kolumn search_*
-- (PR z kodem filtruje po tych kolumnach; bez migracji wyszukiwarka pokazałaby błąd).
--
-- Wycofanie (osobną migracją):
--   ALTER TABLE public.residents     DROP COLUMN IF EXISTS search_name;
--   ALTER TABLE public.organizations DROP COLUMN IF EXISTS search_name;
--   ALTER TABLE public.agenda_items  DROP COLUMN IF EXISTS search_title;
--   DROP FUNCTION IF EXISTS public.f_unaccent(text);
--   (rozszerzenie unaccent można zostawić; nic go nie używa)

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- Niezmienna (IMMUTABLE) otoczka: samo unaccent(text) jest STABLE i nie wejdzie do kolumny generowanej ani indeksu.
-- Słownik podany jawnie, search_path pusty, żeby wynik nie zależał od ustawień sesji.
CREATE OR REPLACE FUNCTION public.f_unaccent(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
SET search_path = ''
AS $$
  SELECT extensions.unaccent('extensions.unaccent'::regdictionary, input)
$$;

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS search_name text
  GENERATED ALWAYS AS (lower(public.f_unaccent(coalesce(first_name, '') || ' ' || coalesce(last_name, '')))) STORED;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS search_name text
  GENERATED ALWAYS AS (lower(public.f_unaccent(coalesce(name, '')))) STORED;

ALTER TABLE public.agenda_items
  ADD COLUMN IF NOT EXISTS search_title text
  GENERATED ALWAYS AS (lower(public.f_unaccent(coalesce(title, '')))) STORED;
