'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { getAppOrganizationId, getAppRole } from '@/lib/auth/app-role'
import { validateTaskInput } from '@/lib/shifts/shift-tasks-view'

/**
 * Zadania zmiany (NUR-TASKS, SC-NUR-13/15). Zapis kontem użytkownika — uprawnienia i izolację placówek egzekwuje RLS.
 * Kierownik placówki i kierownik zmiany dodają zadanie od razu „Do zrobienia”; pozostały personel — jako „Propozycję”.
 * W logach wyłącznie kody techniczne, nigdy treść zadania.
 */
export interface ShiftTaskActionResult {
  success?: boolean
  error?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface AddShiftTaskInput {
  shiftDefinitionId: string
  shiftDate: string
  residentId: string | null
  title: string
  dueTime: string
}

export async function addShiftTaskAction(input: AddShiftTaskInput): Promise<ShiftTaskActionResult> {
  const user = await getCurrentUser()
  const role = getAppRole(user)
  const orgId = getAppOrganizationId(user)
  if (!user || !orgId || (role !== 'nurse' && role !== 'org_admin')) return { error: 'Brak uprawnień do dodawania zadań.' }

  if (!UUID_RE.test(input.shiftDefinitionId) || !DATE_RE.test(input.shiftDate) || (input.residentId && !UUID_RE.test(input.residentId))) {
    return { error: 'Niepoprawne dane zadania.' }
  }
  const invalid = validateTaskInput({ title: input.title, dueTime: input.dueTime })
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  let accepted = role === 'org_admin'
  if (!accepted) {
    const { data } = await supabase.rpc('is_shift_lead', { p_shift_definition_id: input.shiftDefinitionId, p_shift_date: input.shiftDate })
    accepted = data === true
  }

  const { error } = await supabase.from('shift_tasks').insert({
    organization_id: orgId,
    shift_definition_id: input.shiftDefinitionId,
    shift_date: input.shiftDate,
    resident_id: input.residentId,
    title: input.title.trim(),
    due_time: input.dueTime || null,
    source: 'MANUAL',
    status: accepted ? 'TODO' : 'PROPOSED',
    created_by: user.id,
  })
  if (error) {
    console.error('[SHIFT_TASK_ADD_FAIL]', error.code)
    return { error: 'Nie udało się dodać zadania.' }
  }

  revalidatePath('/staff/shift-tasks')
  return { success: true }
}
