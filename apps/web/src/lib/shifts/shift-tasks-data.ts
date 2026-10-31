import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { formatPersonName } from '@/lib/person-name'
import type { TaskResidentOption } from '@/components/shifts/ShiftTaskForm'
import type { TaskSource, TaskStatus, TaskView } from '@/lib/shifts/shift-tasks-view'

/**
 * Zadania jednej zmiany z miejscem pobytu podopiecznych (pokój, łóżko). Czyta kontem użytkownika, więc RLS
 * ogranicza wynik do jego placówki i roli. Wspólne dla listy zadań i wydruku planu.
 */
export async function loadShiftTaskData(supabase: SupabaseClient<Database>, shiftId: string, date: string) {
  const [tasksRes, residentsRes] = await Promise.all([
    supabase
      .from('shift_tasks')
      .select('id, title, due_time, source, status, carried_from_task_id, resident_id, cancel_reason')
      .eq('shift_definition_id', shiftId)
      .eq('shift_date', date),
    supabase
      .from('residents')
      .select('id, first_name, last_name, bed_assignments(unassigned_at, beds(label, rooms(number)))')
      .is('archived_at', null)
      .order('last_name', { ascending: true })
      .limit(500),
  ])

  const taskRows = tasksRes.data ?? []
  const taskIds = taskRows.map((t) => t.id)
  const { data: copies } = taskIds.length
    ? await supabase.from('shift_tasks').select('carried_from_task_id').in('carried_from_task_id', taskIds)
    : { data: [] as { carried_from_task_id: string | null }[] }
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
    }
  })
  return { tasks, carriedOut, options }
}
