'use server'

import { SHIFT_TASK_POLICY } from '@silvercare/contracts/src/generated/facility'
import { revalidatePath } from 'next/cache'
import { authorizeShiftStaff, getShiftStaffAccess } from '@/lib/api-auth'
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
  assigneeUserId?: string | null
  title: string
  dueTime: string
}

export async function addShiftTaskAction(input: AddShiftTaskInput): Promise<ShiftTaskActionResult> {
  if (!UUID_RE.test(input.shiftDefinitionId) || !DATE_RE.test(input.shiftDate)
    || [input.residentId, input.assigneeUserId].some((id) => id && !UUID_RE.test(id))) {
    return { error: 'Niepoprawne dane zadania.' }
  }
  const invalid = validateTaskInput({ title: input.title, dueTime: input.dueTime })
  if (invalid) return { error: invalid }

  const session = await authorizeShiftStaff()
  if (!session) return { error: 'Brak uprawnień do dodawania zadań.' }
  const access = await getShiftStaffAccess(session, input.shiftDefinitionId, input.shiftDate)
  if (!access || (input.assigneeUserId && access !== 'manage')) return { error: 'Brak uprawnień do dodawania zadań na tej zmianie.' }
  const { supabase, orgId, user } = session

  const { error } = await supabase.from('shift_tasks').insert({
    organization_id: orgId,
    shift_definition_id: input.shiftDefinitionId,
    shift_date: input.shiftDate,
    resident_id: input.residentId,
    assignee_user_id: input.assigneeUserId ?? null,
    title: input.title.trim(),
    due_time: input.dueTime || null,
    source: 'MANUAL',
    status: access === 'manage' ? 'TODO' : 'PROPOSED',
    created_by: user.id,
  })
  if (error?.message.includes('SHIFT_ASSIGNEE_NOT_ON_ROSTER')) return { error: 'Ta osoba nie jest już w grafiku zmiany.' }
  if (error) {
    console.error('[SHIFT_TASK_ADD_FAIL]', error.code)
    return { error: 'Nie udało się dodać zadania.' }
  }

  revalidatePath('/staff/shift-tasks')
  return { success: true }
}

async function authorizeTaskManager(taskId: string) {
  const session = await authorizeShiftStaff()
  if (!session) return null
  const { data } = await session.supabase.from('shift_tasks').select('shift_definition_id, shift_date')
    .eq('organization_id', session.orgId).eq('id', taskId).maybeSingle()
  if (!data || await getShiftStaffAccess(session, data.shift_definition_id, data.shift_date) !== 'manage') return null
  return session
}

/** Zatwierdzenie propozycji: tylko kierownik zmiany albo kierownik placówki (RLS); inni nie zmienią żadnego wiersza. */
export async function approveShiftTaskAction(taskId: string): Promise<ShiftTaskActionResult> {
  if (!UUID_RE.test(taskId)) return { error: 'Niepoprawne zadanie.' }
  const session = await authorizeTaskManager(taskId)
  if (!session) return { error: 'Zadanie zatwierdza kierownik zmiany.' }
  const { supabase } = session
  const { data, error } = await supabase.from('shift_tasks').update({ status: 'TODO' }).eq('id', taskId).eq('status', 'PROPOSED').select('id')
  if (error) {
    console.error('[SHIFT_TASK_APPROVE_FAIL]', error.code)
    return { error: 'Nie udało się zatwierdzić zadania.' }
  }
  if (!data?.length) return { error: 'Zadanie zatwierdza kierownik zmiany.' }
  revalidatePath('/staff/shift-tasks')
  return { success: true }
}

/** Przypisuje otwarte zadanie osobie z grafiku. RLS i trigger sprawdzają zakres i aktualność. */
export async function assignShiftTaskAction(
  taskId: string, assigneeUserId: string | null, previousAssigneeId: string | null,
): Promise<ShiftTaskActionResult> {
  if (!UUID_RE.test(taskId) || [assigneeUserId, previousAssigneeId].some((id) => id !== null && !UUID_RE.test(id))) {
    return { error: 'Niepoprawne przypisanie zadania.' }
  }
  const session = await authorizeTaskManager(taskId)
  if (!session) return { error: 'Brak uprawnień.' }
  if (assigneeUserId === previousAssigneeId) return { success: true }
  const { supabase } = session
  const update = supabase.from('shift_tasks').update({ assignee_user_id: assigneeUserId })
    .eq('id', taskId).in('status', SHIFT_TASK_POLICY.assignment.statuses)
  const { data, error } = await (previousAssigneeId ? update.eq('assignee_user_id', previousAssigneeId) : update.is('assignee_user_id', null)).select('id').maybeSingle()
  if (error?.message.includes('SHIFT_ASSIGNEE_NOT_ON_ROSTER')) return { error: 'Ta osoba nie jest już w grafiku zmiany.' }
  if (error) console.error('[SHIFT_TASK_ASSIGN_FAIL]', error.code)
  if (!data) return { error: 'Nie zapisano przypisania. Odśwież listę i sprawdź stan zadania oraz uprawnienia.' }
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
  if (!UUID_RE.test(input.taskId) || !SHIFT_TASK_POLICY.settlementPaths.includes(input.path)) return { error: 'Niepoprawne dane rozliczenia.' }
  const session = await authorizeTaskManager(input.taskId)
  if (!session) return { error: 'Zadania rozlicza kierownik zmiany.' }
  if (input.path === 'CANCELLED') {
    const invalid = validateCancelReason(input.reason ?? '')
    if (invalid) return { error: invalid }
  }
  if (input.path === 'CARRIED' && (!input.targetShiftDefinitionId || !UUID_RE.test(input.targetShiftDefinitionId) || !DATE_RE.test(input.targetDate ?? ''))) {
    return { error: 'Wybierz zmianę i datę docelową.' }
  }

  const { error } = await session.supabase.rpc('settle_shift_task', {
    p_task_id: input.taskId,
    p_path: input.path,
    // typy generowane nie znają argumentów dopuszczających NULL; funkcja SQL przyjmuje NULL dla ścieżek bez celu i powodu
    p_reason: (input.reason ?? null) as string,
    p_target_definition_id: (input.targetShiftDefinitionId ?? null) as string,
    p_target_date: (input.targetDate ?? null) as string,
  })
  if (error) {
    if (error.message.includes('SHIFT_NOT_LEAD')) return { error: 'Zadania rozlicza kierownik zmiany.' }
    if (error.message.includes('SHIFT_TASK_ALREADY_CARRIED')) return { error: 'To zadanie zostało już przeniesione.' }
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
  const session = await authorizeShiftStaff()
  if (!session || await getShiftStaffAccess(session, input.shiftDefinitionId, input.shiftDate) !== 'manage') {
    return { error: 'Plan zatwierdza kierownik zmiany.' }
  }

  const { supabase } = session
  const { data: existing } = await supabase
    .from('shift_plan_approvals')
    .select('version')
    .eq('shift_definition_id', input.shiftDefinitionId)
    .eq('shift_date', input.shiftDate)
    .order('version', { ascending: false }).limit(1)
  const { error } = await supabase.from('shift_plan_approvals').insert({
    organization_id: session.orgId,
    shift_definition_id: input.shiftDefinitionId,
    shift_date: input.shiftDate,
    version: nextPlanVersion((existing ?? []).map((r) => r.version)),
    approved_by: session.user.id,
  })
  if (error) {
    if (error.code === '42501') return { error: 'Plan zatwierdza kierownik zmiany.' }
    if (error.message.includes('SHIFT_PLAN_ASSIGNEE_NOT_ON_ROSTER')) {
      return { error: 'Zmień przypisania zadań do osób spoza aktualnego grafiku, a następnie zatwierdź plan.' }
    }
    if (error.code === '23505') return { error: 'Plan został właśnie zatwierdzony przez kogoś innego. Odśwież stronę.' }
    console.error('[SHIFT_PLAN_APPROVE_FAIL]', error.code)
    return { error: 'Nie udało się zatwierdzić planu.' }
  }
  revalidatePath('/staff/shift-tasks')
  return { success: true }
}

/** Zapis wydruku planu: ślad w audycie i printed_at. RPC sprawdza rolę, akceptację i aktualność planu. */
export async function recordShiftPlanPrintAction(input: { shiftDefinitionId: string; shiftDate: string; planVersion: number }): Promise<ShiftTaskActionResult> {
  if (!UUID_RE.test(input.shiftDefinitionId) || !DATE_RE.test(input.shiftDate) ||
      !Number.isInteger(input.planVersion) || input.planVersion < 1 || input.planVersion > 2_147_483_647) {
    return { error: 'Niepoprawne dane planu.' }
  }
  const session = await authorizeShiftStaff()
  if (!session || await getShiftStaffAccess(session, input.shiftDefinitionId, input.shiftDate) !== 'manage') {
    return { error: 'Plan drukuje kierownik zmiany.' }
  }
  const { error } = await session.supabase.rpc('record_shift_plan_print', {
    p_shift_definition_id: input.shiftDefinitionId,
    p_shift_date: input.shiftDate,
    p_expected_version: input.planVersion,
  })
  if (error) {
    if (error.message.includes('SHIFT_PLAN_NOT_APPROVED')) return { error: 'Najpierw zatwierdź plan zmiany.' }
    if (error.message.includes('SHIFT_PLAN_VERSION_MISMATCH')) return { error: 'Zatwierdzono nowszą wersję planu. Odśwież podgląd przed wydrukiem.' }
    if (error.message.includes('SHIFT_PLAN_STALE')) return { error: 'Zadania zmieniły się po akceptacji. Zatwierdź plan ponownie.' }
    if (error.message.includes('SHIFT_NOT_LEAD')) return { error: 'Plan drukuje kierownik zmiany.' }
    console.error('[SHIFT_PLAN_PRINT_FAIL]', error.code)
    return { error: 'Nie udało się zapisać wydruku.' }
  }
  return { success: true }
}
