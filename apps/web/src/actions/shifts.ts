'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { safeGetCookieStore, isImpersonationSessionActive } from '@/lib/impersonation-guards'
import { validateShiftDefinitionInput, type ShiftDefinitionInput } from '@/lib/shifts/shift-definitions'

/**
 * Definicje zmian (NUR-SHIFT-CONFIG): konfiguruje wyłącznie kierownik placówki (org_admin), personel opiekuńczy czyta.
 * Zapisy idą kontem użytkownika, więc uprawnienia i izolację placówek egzekwuje RLS — bez klucza service_role.
 */
export interface ShiftActionResult {
  success?: boolean
  error?: string
}

async function requireOrgAdminSession(): Promise<{ orgId: string } | { error: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Brak aktywnej sesji.' }
  const cookieStore = await safeGetCookieStore()
  if (isImpersonationSessionActive(cookieStore, user)) return { error: 'Operacja niedozwolona w trybie podglądu.' }
  const role = user.app_metadata?.role as string | undefined
  const orgId = user.app_metadata?.organization_id as string | undefined
  if (role !== 'org_admin' || !orgId) return { error: 'Zmiany konfiguruje kierownik placówki.' }
  return { orgId }
}

export async function createShiftDefinitionAction(input: ShiftDefinitionInput): Promise<ShiftActionResult> {
  const validation = validateShiftDefinitionInput(input)
  if (!validation.valid) return { error: validation.error }

  const session = await requireOrgAdminSession()
  if ('error' in session) return session

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('shift_definitions')
    .select('order_index')
    .order('order_index', { ascending: false })
    .limit(1)

  const { error } = await supabase.from('shift_definitions').insert({
    organization_id: session.orgId,
    code: validation.data.code,
    name: validation.data.name,
    start_time: validation.data.startTime,
    end_time: validation.data.endTime,
    order_index: (existing?.[0]?.order_index ?? 0) + 1,
  })

  if (error) {
    if (error.message.includes('SHIFT_DEFINITIONS_MAX_THREE')) return { error: 'Placówka ma najwyżej 3 aktywne zmiany na dobę. Dezaktywuj jedną, aby dodać nową.' }
    if (error.code === '23505') return { error: 'Zmiana o takiej nazwie już istnieje.' }
    console.error('[SHIFT_DEFINITION_CREATE_FAIL]', error.code)
    return { error: 'Nie udało się zapisać zmiany.' }
  }

  revalidatePath('/admin/shifts')
  return { success: true }
}

export async function setShiftDefinitionActiveAction(definitionId: string, isActive: boolean): Promise<ShiftActionResult> {
  const session = await requireOrgAdminSession()
  if ('error' in session) return session

  const supabase = await createClient()
  const { error } = await supabase
    .from('shift_definitions')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', definitionId)

  if (error) {
    if (error.message.includes('SHIFT_DEFINITIONS_MAX_THREE')) return { error: 'Placówka ma najwyżej 3 aktywne zmiany na dobę.' }
    console.error('[SHIFT_DEFINITION_TOGGLE_FAIL]', error.code)
    return { error: 'Nie udało się zmienić statusu zmiany.' }
  }

  revalidatePath('/admin/shifts')
  return { success: true }
}
