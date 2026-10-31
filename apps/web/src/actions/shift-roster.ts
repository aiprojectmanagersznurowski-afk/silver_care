'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { safeGetCookieStore, isImpersonationSessionActive } from '@/lib/impersonation-guards'

/**
 * Grafik zmian (NUR-SHIFT-LEAD, SC-NUR-12/AC1a): kierownik placówki wpisuje personel na zmianę i wyznacza kierownika zmiany.
 * Zapisy idą kontem użytkownika, więc uprawnienia, izolację placówek i zasady (jeden kierownik na zmianę i dzień,
 * kierownik tylko z personelu opiekuńczego tej placówki) egzekwuje baza — bez klucza service_role.
 */
export interface RosterActionResult {
  success?: boolean
  error?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function requireOrgAdminSession(): Promise<{ orgId: string } | { error: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Brak aktywnej sesji.' }
  const cookieStore = await safeGetCookieStore()
  if (isImpersonationSessionActive(cookieStore, user)) return { error: 'Operacja niedozwolona w trybie podglądu.' }
  const role = user.app_metadata?.role as string | undefined
  const orgId = user.app_metadata?.organization_id as string | undefined
  if (role !== 'org_admin' || !orgId) return { error: 'Grafik układa kierownik placówki.' }
  return { orgId }
}

function failure(prefix: string, error: { code?: string; message: string }): RosterActionResult {
  if (error.message.includes('SHIFT_ROSTER_FOREIGN_USER')) return { error: 'Do grafiku można wpisać tylko personel tej placówki.' }
  if (error.message.includes('SHIFT_LEAD_MUST_BE_NURSE')) return { error: 'Kierownikiem zmiany może być tylko personel opiekuńczy.' }
  if (error.code === '23505') return { error: 'Ta osoba jest już w grafiku tej zmiany.' }
  console.error(prefix, error.code)
  return { error: 'Nie udało się zapisać grafiku.' }
}

export async function addToRosterAction(input: { shiftDefinitionId: string; shiftDate: string; userId: string }): Promise<RosterActionResult> {
  if (!UUID_RE.test(input.shiftDefinitionId) || !UUID_RE.test(input.userId) || !DATE_RE.test(input.shiftDate)) {
    return { error: 'Niepoprawne dane wpisu do grafiku.' }
  }
  const session = await requireOrgAdminSession()
  if ('error' in session) return session

  const supabase = await createClient()
  const { error } = await supabase.from('shift_roster').insert({
    organization_id: session.orgId,
    shift_definition_id: input.shiftDefinitionId,
    shift_date: input.shiftDate,
    user_id: input.userId,
    is_shift_lead: false,
  })
  if (error) return failure('[SHIFT_ROSTER_ADD_FAIL]', error)

  revalidatePath('/admin/shifts')
  return { success: true }
}

export async function removeFromRosterAction(rosterId: string): Promise<RosterActionResult> {
  if (!UUID_RE.test(rosterId)) return { error: 'Niepoprawny wpis grafiku.' }
  const session = await requireOrgAdminSession()
  if ('error' in session) return session

  const supabase = await createClient()
  const { error } = await supabase.from('shift_roster').delete().eq('id', rosterId)
  if (error) return failure('[SHIFT_ROSTER_REMOVE_FAIL]', error)

  revalidatePath('/admin/shifts')
  return { success: true }
}

/** Wyznacza kierownika zmiany: najpierw zdejmuje funkcję z poprzedniego (jeden na zmianę i dzień), potem nadaje wskazanemu. */
export async function setShiftLeadAction(rosterId: string): Promise<RosterActionResult> {
  if (!UUID_RE.test(rosterId)) return { error: 'Niepoprawny wpis grafiku.' }
  const session = await requireOrgAdminSession()
  if ('error' in session) return session

  const supabase = await createClient()
  const { data: target, error: readError } = await supabase
    .from('shift_roster')
    .select('shift_definition_id, shift_date')
    .eq('id', rosterId)
    .single()
  if (readError || !target) return { error: 'Nie znaleziono wpisu grafiku.' }

  const { error: clearError } = await supabase
    .from('shift_roster')
    .update({ is_shift_lead: false })
    .eq('shift_definition_id', target.shift_definition_id)
    .eq('shift_date', target.shift_date)
    .eq('is_shift_lead', true)
  if (clearError) return failure('[SHIFT_LEAD_CLEAR_FAIL]', clearError)

  const { error } = await supabase.from('shift_roster').update({ is_shift_lead: true }).eq('id', rosterId)
  if (error) return failure('[SHIFT_LEAD_SET_FAIL]', error)

  revalidatePath('/admin/shifts')
  return { success: true }
}
