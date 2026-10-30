'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { getAppOrganizationId, getAppRole } from '@/lib/auth/app-role'
import { nextPlanVersion, validateCancelReason, validateTaskInput } from '@/lib/shifts/shift-tasks-view'

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

async function requireStaff() {
  const user = await getCurrentUser()
  const role = getAppRole(user)
  const orgId = getAppOrganizationId(user)
  if (!user || !orgId || (role !== 'nurse' && role !== 'org_admin')) return null
  return { user, orgId }
}

/** Zatwierdzenie propozycji: tylko kierownik zmiany albo kierownik placówki (RLS); inni nie zmienią żadnego wiersza. */
export async function approveShiftTaskAction(taskId: string): Promise<ShiftTaskActionResult> {
  if (!UUID_RE.test(taskId)) return { error: 'Niepoprawne zadanie.' }
  if (!(await requireStaff())) return { error: 'Brak uprawnień.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('shift_tasks').update({ status: 'TODO' }).eq('id', taskId).eq('status', 'PROPOSED').select('id')
  if (error) {
    console.error('[SHIFT_TASK_APPROVE_FAIL]', error.code)
    return { error: 'Nie udało się zatwierdzić zadania.' }
  }
  if (!data?.length) return { error: 'Zadanie zatwierdza kierownik zmiany.' }
  revalidatePath('/staff/shift-tasks')
  return { success: true }
}

export interface SettleShiftTaskInput {
  taskId: string
  path: 'DONE' | 'CANCELLED' | 'CARRIED'
  reason?: string
  targetShiftDefinitionId?: string
  targetDate?: string
}

/** Rozliczenie zadania trzema ścieżkami przez RPC settle_shift_task (tożsamość i uprawnienia z sesji). */
export async function settleShiftTaskAction(input: SettleShiftTaskInput): Promise<ShiftTaskActionResult> {
  if (!UUID_RE.test(input.taskId) || !['DONE', 'CANCELLED', 'CARRIED'].includes(input.path)) return { error: 'Niepoprawne dane rozliczenia.' }
  if (!(await requireStaff())) return { error: 'Brak uprawnień.' }
  if (input.path === 'CANCELLED') {
    const invalid = validateCancelReason(input.reason ?? '')
    if (invalid) return { error: invalid }
  }
  if (input.path === 'CARRIED' && (!input.targetShiftDefinitionId || !UUID_RE.test(input.targetShiftDefinitionId) || !DATE_RE.test(input.targetDate ?? ''))) {
    return { error: 'Wybierz zmianę i datę docelową.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('settle_shift_task', {
    p_task_id: input.taskId,
    p_path: input.path,
    // typy generowane nie znają argumentów dopuszczających NULL; funkcja SQL przyjmuje NULL dla ścieżek bez celu i powodu
    p_reason: (input.reason ?? null) as string,
    p_target_definition_id: (input.targetShiftDefinitionId ?? null) as string,
    p_target_date: (input.targetDate ?? null) as string,
  })
  if (error) {
    if (error.message.includes('SHIFT_NOT_LEAD')) return { error: 'Zadania rozlicza kierownik zmiany.' }
    if (error.message.includes('SHIFT_CARRY_TARGET_INVALID')) return { error: 'Wybierz inną zmianę lub datę niż obecna.' }
    if (error.message.includes('SHIFT_TASK_SETTLED')) return { error: 'To zadanie jest już rozliczone.' }
    console.error('[SHIFT_TASK_SETTLE_FAIL]', error.code)
    return { error: 'Nie udało się rozliczyć zadania.' }
  }
  revalidatePath('/staff/shift-tasks')
  return { success: true }
}

/** Akceptacja planu zmiany: dopisuje kolejną wersję. Uprawnienia egzekwuje RLS (kierownik zmiany, kierownik placówki). */
export async function approveShiftPlanAction(input: { shiftDefinitionId: string; shiftDate: string }): Promise<ShiftTaskActionResult> {
  if (!UUID_RE.test(input.shiftDefinitionId) || !DATE_RE.test(input.shiftDate)) return { error: 'Niepoprawne dane planu.' }
  const session = await requireStaff()
  if (!session) return { error: 'Brak uprawnień.' }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('shift_plan_approvals')
    .select('version')
    .eq('shift_definition_id', input.shiftDefinitionId)
    .eq('shift_date', input.shiftDate)
  const { error } = await supabase.from('shift_plan_approvals').insert({
    organization_id: session.orgId,
    shift_definition_id: input.shiftDefinitionId,
    shift_date: input.shiftDate,
    version: nextPlanVersion((existing ?? []).map((r) => r.version)),
    approved_by: session.user.id,
  })
  if (error) {
    if (error.code === '42501') return { error: 'Plan zatwierdza kierownik zmiany.' }
    if (error.code === '23505') return { error: 'Plan został właśnie zatwierdzony przez kogoś innego. Odśwież stronę.' }
    console.error('[SHIFT_PLAN_APPROVE_FAIL]', error.code)
    return { error: 'Nie udało się zatwierdzić planu.' }
  }
  revalidatePath('/staff/shift-tasks')
  return { success: true }
}
