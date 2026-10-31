import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { getAppRole } from '@/lib/auth/app-role'
import { PageHeader } from '@/components/patterns/PageHeader'
import { ListEmpty } from '@/components/patterns/ListState'
import { ShiftTaskForm } from '@/components/shifts/ShiftTaskForm'
import { ShiftPlanApproval } from '@/components/shifts/ShiftPlanApproval'
import { ShiftTaskGroups } from '@/components/shifts/ShiftTaskGroups'
import { formatDayLabel, normalizeDateParam, shiftDay } from '@/lib/shifts/roster-week'
import { formatShiftRange, trimSeconds } from '@/lib/shifts/shift-definitions'
import { loadShiftTaskData } from '@/lib/shifts/shift-tasks-data'
import { groupTasks, normalizeGroupParam } from '@/lib/shifts/shift-tasks-view'

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
          <TasksSection shiftId={shift.id} shiftCode={shift.code} date={date} group={group} isAdmin={role === 'org_admin'} targets={shifts.map((s) => ({ id: s.id, name: s.name }))} />
        </>
      )}
    </div>
  )
}

interface TasksSectionProps {
  shiftId: string
  shiftCode: string
  date: string
  group: 'room' | 'resident'
  isAdmin: boolean
  targets: { id: string; name: string }[]
}

async function TasksSection({ shiftId, shiftCode, date, group, isAdmin, targets }: TasksSectionProps) {
  const supabase = await createClient()
  const [data, leadRes, approvalsRes] = await Promise.all([
    loadShiftTaskData(supabase, shiftId, date),
    isAdmin ? Promise.resolve({ data: true }) : supabase.rpc('is_shift_lead', { p_shift_definition_id: shiftId, p_shift_date: date }),
    supabase.from('shift_plan_approvals').select('version').eq('shift_definition_id', shiftId).eq('shift_date', date),
  ])
  const { tasks, carriedOut, options } = data
  const canSettle = leadRes.data === true
  const planVersion = Math.max(0, ...(approvalsRes.data ?? []).map((a) => a.version)) || null

  const groups = groupTasks(tasks, group, carriedOut)

  return (
    <>
      <ShiftPlanApproval shiftDefinitionId={shiftId} shiftDate={date} version={planVersion} canApprove={canSettle} printHref={canSettle && planVersion ? `/staff/shift-plan/print?shift=${shiftCode}&date=${date}` : null} />
      <ShiftTaskForm shiftDefinitionId={shiftId} shiftDate={date} residents={options} />
      {groups.length === 0 ? (
        <ListEmpty title="Brak zadań na tę zmianę" description="Dodaj pierwsze zadanie formularzem powyżej." />
      ) : (
        <ShiftTaskGroups groups={groups} shiftDate={date} canSettle={canSettle} targets={targets} />
      )}
    </>
  )
}
