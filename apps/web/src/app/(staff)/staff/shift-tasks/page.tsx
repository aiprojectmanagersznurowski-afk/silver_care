import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { getAppRole } from '@/lib/auth/app-role'
import { formatPersonName } from '@/lib/person-name'
import { PageHeader } from '@/components/patterns/PageHeader'
import { ListEmpty } from '@/components/patterns/ListState'
import { ShiftTaskForm, type TaskResidentOption } from '@/components/shifts/ShiftTaskForm'
import { ShiftTaskGroups } from '@/components/shifts/ShiftTaskGroups'
import { formatDayLabel, normalizeDateParam, shiftDay } from '@/lib/shifts/roster-week'
import { formatShiftRange, trimSeconds } from '@/lib/shifts/shift-definitions'
import { groupTasks, normalizeGroupParam, type TaskSource, type TaskStatus, type TaskView } from '@/lib/shifts/shift-tasks-view'

export const dynamic = 'force-dynamic'

const navClass = 'inline-flex min-h-touch items-center rounded-lg border border-input px-3 text-sm hover:bg-muted'
const activeClass = 'inline-flex min-h-touch items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground'

type SearchParams = Promise<{ shift?: string; date?: string; group?: string }>

/** Zadania zmiany (NUR-TASKS, SC-NUR-13/15): personel opiekuńczy i kierownik placówki; bliscy nie mają dostępu (RLS). */
export default async function ShiftTasksPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()
  const role = getAppRole(user)
  if (!user || (role !== 'nurse' && role !== 'org_admin')) redirect('/')

  const params = await searchParams
  const date = normalizeDateParam(params.date)
  const group = normalizeGroupParam(params.group)
  const supabase = await createClient()

  const { data: defs } = await supabase
    .from('shift_definitions')
    .select('id, name, code, start_time, end_time')
    .eq('is_active', true)
    .order('order_index', { ascending: true })
  const shifts = defs ?? []
  const shift = shifts.find((s) => s.code === params.shift) ?? shifts[0]

  const qs = (over: { shift?: string; date?: string; group?: string }) =>
    `?${new URLSearchParams({ shift: over.shift ?? shift?.code ?? '', date: over.date ?? date, group: over.group ?? group })}`

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader title="Zadania zmiany" description={`${formatDayLabel(date)}${shift ? ` · ${shift.name}, ${formatShiftRange(trimSeconds(shift.start_time), trimSeconds(shift.end_time))}` : ''}`} />

      {!shift ? (
        <ListEmpty title="Brak zdefiniowanych zmian" description="Kierownik placówki dodaje zmiany w sekcji „Zmiany i grafik”." />
      ) : (
        <>
          <nav className="flex flex-wrap gap-2" aria-label="Wybór zmiany i dnia">
            {shifts.map((s) => (
              <Link key={s.id} href={qs({ shift: s.code })} className={s.id === shift.id ? activeClass : navClass}>{s.name}</Link>
            ))}
            <Link href={qs({ date: shiftDay(date, -1) })} className={navClass}>Poprzedni dzień</Link>
            <Link href={qs({ date: shiftDay(date, 1) })} className={navClass}>Następny dzień</Link>
            <Link href={qs({ group: 'room' })} className={group === 'room' ? activeClass : navClass}>Według pokoi</Link>
            <Link href={qs({ group: 'resident' })} className={group === 'resident' ? activeClass : navClass}>Według podopiecznych</Link>
          </nav>
          <TasksSection shiftId={shift.id} date={date} group={group} />
        </>
      )}
    </div>
  )
}

async function TasksSection({ shiftId, date, group }: { shiftId: string; date: string; group: 'room' | 'resident' }) {
  const supabase = await createClient()
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

  const tasks: TaskView[] = (tasksRes.data ?? []).map((t) => {
    const p = t.resident_id ? places.get(t.resident_id) : undefined
    return {
      id: t.id, title: t.title, dueTime: t.due_time, source: t.source as TaskSource, status: t.status as TaskStatus,
      carriedFromTaskId: t.carried_from_task_id, residentId: t.resident_id, residentName: p?.name ?? null,
      room: p?.room ?? null, bed: p?.bed ?? null, cancelReason: t.cancel_reason,
    }
  })
  const groups = groupTasks(tasks, group)

  return (
    <>
      <ShiftTaskForm shiftDefinitionId={shiftId} shiftDate={date} residents={options} />
      {groups.length === 0 ? (
        <ListEmpty title="Brak zadań na tę zmianę" description="Dodaj pierwsze zadanie formularzem powyżej." />
      ) : (
        <ShiftTaskGroups groups={groups} />
      )}
    </>
  )
}
