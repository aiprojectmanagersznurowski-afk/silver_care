import type { SupabaseClient } from '@supabase/supabase-js'

/** Jedyne dane podopiecznego dostępne dla bliskich (SC-FAM-08, get_family_resident_overview). */
export interface FamilyResidentOverview {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  death_date: string | null
  contract_end_date: string | null
  archived_at: string | null
}

export type FamilyResidentsResult =
  | { status: 'ok'; residents: FamilyResidentOverview[] }
  | { status: 'error' }

/**
 * Podopieczni powiązani z zalogowanym bliskim — wyłącznie przez wąskie RPC (@REQ: FAM-RESIDENT-DATA-MINIMIZATION).
 * Tabela residents nie ma polityki odczytu dla ról bliskich; błąd RPC jest jawnym błędem, bez fallbacku.
 */
export async function getFamilyResidents(supabase: SupabaseClient): Promise<FamilyResidentsResult> {
  const { data, error } = await supabase.rpc('get_family_resident_overview')
  if (error) {
    console.error('[portal-rodziny] odczyt nieudany', { code: error.code })
    return { status: 'error' }
  }
  return { status: 'ok', residents: (data ?? []) as FamilyResidentOverview[] }
}
