import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPersonName } from '@/lib/person-name'
import type { TaskResidentOption } from '@/components/shifts/ShiftTaskForm'
import type { TaskSource, TaskStatus, TaskView } from '@/lib/shifts/shift-tasks-view'

/**
 * Zadania jednej zmiany z miejscem pobytu podopiecznych (pokój, łóżko). Czyta kontem użytkownika, więc RLS
 * ogranicza wynik do jego placówki i roli. Wspólne dla listy zadań i wydruku planu.
 */
export async function loadShiftTaskData(supabase: SupabaseClient<Database>, shiftId: string, date: string) {
  const [tasksRes, residentsRes, rosterRes] = await Promise.all([
    supabase
      .from('shift_tasks')
      .select('id, title, due_time, source, status, carried_from_task_id, resident_id, cancel_reason, assignee_user_id, created_at, updated_at')
      .eq('shift_definition_id', shiftId)
      .eq('shift_date', date),
    supabase
      .from('residents')
      .select('id, first_name, last_name, bed_assignments(unassigned_at, beds(label, rooms(number)))')
      .is('archived_at', null)
      .order('last_name', { ascending: true })
      .limit(500),
    supabase.from('shift_roster').select('user_id, organization_id')
      .eq('shift_definition_id', shiftId).eq('shift_date', date),
  ])

  const taskRows = tasksRes.data ?? []
  const taskIds = taskRows.map((t) => t.id)
  const [copyResult, assignees] = await Promise.all([
    taskIds.length
      ? supabase.from('shift_tasks').select('carried_from_task_id').in('carried_from_task_id', taskIds)
      : Promise.resolve({ data: [] as { carried_from_task_id: string | null }[] }),
    loadRosterNames(rosterRes.data ?? []),
  ])
  const copies = copyResult.data
  const assigneeNames = new Map(assignees.map(({ id, name }) => [id, name]))
  const carriedOut = (copies ?? []).map((c) => c.carried_from_task_id).filter((id): id is string => !!id)

  const places = new Map<string, { name: string; room: string | null; bed: string | null }>()
  const options: TaskResidentOption[] = []
  for (const r of residentsRes.data ?? []) {
    const active = (r.bed_assignments ?? []).find((a) => a.unassigned_at === null)
    const room = active?.beds?.rooms?.number ?? null
    const bed = active?.beds?.label ?? null
    const name = formatPersonName(r.first_name, r.last_name)
    places.set(r.id, { name, room: room === null ? null : String(room), bed })
    options.push({ id: r.id, label: room === null ? name : `${name} · pokój ${room}` })
  }

  const tasks: TaskView[] = taskRows.map((t) => {
    const p = t.resident_id ? places.get(t.resident_id) : undefined
    return {
      id: t.id, title: t.title, dueTime: t.due_time, source: t.source as TaskSource, status: t.status as TaskStatus,
      carriedFromTaskId: t.carried_from_task_id, residentId: t.resident_id, residentName: p?.name ?? null,
      room: p?.room ?? null, bed: p?.bed ?? null, cancelReason: t.cancel_reason,
      assigneeUserId: t.assignee_user_id, assigneeName: assigneeNames.get(t.assignee_user_id ?? '') ?? null,
    }
  })
  const lastPlanChange = taskRows.reduce((latest, task) => task.status === 'PROPOSED'
    ? latest : Math.max(latest, Date.parse(task.created_at), Date.parse(task.updated_at)), 0)
  return { tasks, carriedOut, options, assignees, lastPlanChange }
}

export interface ShiftAssigneeOption {
  id: string
  name: string
}

/** Do przeglądarki trafiają wyłącznie nazwy osób z grafiku odczytanego kontem użytkownika. */
async function loadRosterNames(roster: { user_id: string; organization_id: string }[]): Promise<ShiftAssigneeOption[]> {
  if (!roster.length) return []
  const admin = createAdminClient()
  const people = await Promise.all(roster.map(async ({ user_id, organization_id }) => {
    const { data, error } = await admin.auth.admin.getUserById(user_id)
    if (error) {
      console.error('[SHIFT_ROSTER_PERSON_LOOKUP]', error.code)
      return null
    }
    const user = data.user
    const metadata = user?.app_metadata
    if (metadata?.organization_id !== organization_id || metadata.is_active === false ||
        (metadata.role !== 'org_admin' && metadata.role !== 'nurse')) return null
    const display = user?.user_metadata?.full_name
    const name = typeof display === 'string' ? display.trim() : ''
    return { id: user_id, name: name || `Pracownik ${user_id.slice(0, 8)}` }
  }))
  return people.filter((person) => person !== null).sort((a, b) => a.name.localeCompare(b.name, 'pl'))
}
