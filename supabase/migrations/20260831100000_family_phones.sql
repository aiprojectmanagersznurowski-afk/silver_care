-- Migration: 20260831100000_family_phones.sql

-- Add phone column to invitations
ALTER TABLE public.resident_invitations ADD COLUMN IF NOT EXISTS phone text;
