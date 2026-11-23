import { SHIFT_POLICY, SHIFT_TASK_POLICY } from '@silvercare/contracts/src/generated/facility'
import { requireOrgFeature } from '@/lib/feature-flags'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { getAppOrganizationId, getAppRole } from '@/lib/auth/app-role'
import { PageHeader } from '@/components/patterns/PageHeader'
import { ListEmpty, ListError } from '@/components/patterns/ListState'
import { ShiftTaskForm } from '@/components/shifts/ShiftTaskForm'
import { ShiftPlanApproval } from '@/components/shifts/ShiftPlanApproval'
import { ShiftHandoverReview } from '@/components/shifts/ShiftHandoverReview'
import { ShiftTaskGroups } from '@/components/shifts/ShiftTaskGroups'
import { formatDayLabel, normalizeDateParam, shiftDay } from '@/lib/shifts/roster-week'
import { formatShiftRange, trimSeconds } from '@/lib/shifts/shift-definitions'
import { loadShiftTaskData } from '@/lib/shifts/shift-tasks-data'
import { loadShiftTaskVoiceEvidence, type ShiftTaskVoiceEvidence } from '@/lib/shifts/shift-task-voice-evidence'
import { FeatureFlagsMfa } from '@/components/admin/FeatureFlagsMfa'
import { groupTasks, normalizeGroupParam, type TaskGroupMode } from '@/lib/shifts/shift-tasks-view'

export const dynamic = 'force-dynamic'

const navClass = 'inline-flex min-h-touch items-center rounded-lg border border-input px-3 text-sm hover:bg-muted'
const activeClass = 'inline-flex min-h-touch items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground'

type BoardView = TaskGroupMode | typeof SHIFT_TASK_POLICY.board.defaultView
type Filters = { shift?: string; date?: string; group?: string; mine?: string; closure?: string; auditPage?: string }
type SearchParams = Promise<Filters & { resident?: string }>

/** Zadania zmiany (NUR-TASKS, SC-NUR-13/15): personel opiekuńczy i kierownik placówki; bliscy nie mają dostępu (RLS). */
export default async function ShiftTasksPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await requireOrgFeature('module_shift_tasks')).allowed) return <FeatureDisabledState />

  const user = await getCurrentUser()
  const role = getAppRole(user)
  const organizationId = getAppOrganizationId(user)
  if (!user || !organizationId || (role !== 'nurse' && role !== 'org_admin')) redirect('/')

  const params = await searchParams
  const board = SHIFT_TASK_POLICY.board
  const group = board.defaultView === params.group || !params.group ? board.defaultView : normalizeGroupParam(params.group)
  const mine = params.mine === board.mineFilter
  const auditPage = Number(params.auditPage)
  const historyPage = Number.isSafeInteger(auditPage) && auditPage > 0 && auditPage < 1000 ? auditPage : 1
  const supabase = await createClient()

  const { data: defs } = await supabase
    .from('shift_definitions')
    .select('id, name, code, start_time, end_time')
    .eq('is_active', true)
    .order('order_index', { ascending: true })
  const shifts = defs ?? []
  const now = new Date()
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: SHIFT_POLICY.timezone, hour: '2-digit',
    minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now)
  const runningShift = shifts.find(({ start_time: start, end_time: end }) =>
    start < end ? start <= time && time < end : start <= time || time < end)
  const shift = shifts.find((s) => s.code === params.shift) ?? runningShift ?? shifts[0]
  const today = normalizeDateParam(undefined, now)
  const date = !params.date && shift && shift.end_time <= shift.start_time && time < shift.end_time
    ? shiftDay(today, -1) : normalizeDateParam(params.date, now)

  const qs = (over: Filters) => {
    const query = new URLSearchParams({ shift: over.shift ?? shift?.code ?? '', date: over.date ?? date, group: over.group ?? group })
    if ((over.mine ?? params.mine) === board.mineFilter) query.set('mine', board.mineFilter)
    if (over.closure === '1') query.set('closure', '1')
    if (over.auditPage) query.set('auditPage', over.auditPage)
    return `?${query}`
  }

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
            <Link href={qs({ group: board.defaultView, mine: board.defaultFilter })} className={group === board.defaultView && !mine ? activeClass : navClass}>Wszystkie zadania</Link>
            <Link href={qs({ mine: board.mineFilter })} className={mine ? activeClass : navClass}>Moje zadania</Link>
            <Link href={qs({ group: 'room' })} className={group === 'room' ? activeClass : navClass}>Według pokoi</Link>
            <Link href={qs({ group: 'resident' })} className={group === 'resident' ? activeClass : navClass}>Według podopiecznych</Link>
            <Link href={qs({ group: 'assignee' })} className={group === 'assignee' ? activeClass : navClass}>Według pracowników</Link>
          </nav>
          <TasksSection organizationId={organizationId} userId={user.id} shiftId={shift.id} shiftCode={shift.code}
            date={date} group={group} mine={mine} isAdmin={role === 'org_admin'}
            targets={shifts.map((s) => ({ id: s.id, name: s.name }))} residentParam={params.resident}
            closure={params.closure === '1'} historyPage={historyPage} qs={qs} />
        </>
      )}
    </div>
  )
}

interface TasksSectionProps {
  organizationId: string
  userId: string
  shiftId: string
  shiftCode: string
  date: string
  group: BoardView
  mine: boolean
  closure: boolean
  historyPage: number
  qs: (over: Filters) => string
  isAdmin: boolean
  targets: { id: string; name: string }[]
  /** Podopieczny z karty („Dodaj zadanie”, SC-ADM-21); przyjmowany tylko, gdy jest na liście wyboru tej placówki. */
  residentParam?: string
}

async function TasksSection({
  organizationId, userId, shiftId, shiftCode, date, group, mine, isAdmin, targets, residentParam, closure, historyPage, qs,
}: TasksSectionProps) {
  const supabase = await createClient()
  const { data: roster } = isAdmin ? { data: { is_shift_lead: true } } : await supabase.from('shift_roster')
    .select('is_shift_lead').eq('organization_id', organizationId).eq('shift_definition_id', shiftId)
    .eq('shift_date', date).eq('user_id', userId).maybeSingle()
  if (!roster) return <ListEmpty title="Brak dostępu do zadań tej zmiany" description="Wybierz zmianę, na której jesteś w grafiku." />
  const [data, approvalsRes] = await Promise.all([
    loadShiftTaskData(supabase, shiftId, date),
    supabase.rpc('get_shift_plan_status', { p_shift: shiftId, p_date: date }).maybeSingle(),
  ])
  const { tasks, taskVersions, carriedOut, options, assignees } = data
  const canSettle = roster.is_shift_lead
  const approval = approvalsRes.data
  const stale = approval?.stale ?? false

  const voice = canSettle && tasks.some(({ status }) => status === 'TODO')
    ? await loadShiftTaskVoiceEvidence(supabase, organizationId, shiftId, date)
    : { rows: [] }
  const evidenceByTask = new Map<string, ShiftTaskVoiceEvidence[]>()
  for (const evidence of voice.rows) {
    if (taskVersions.get(evidence.task_id) !== evidence.task_updated_at) continue
    const entries = evidenceByTask.get(evidence.task_id) ?? []
    entries.push(evidence)
    evidenceByTask.set(evidence.task_id, entries)
  }
  const filtered = mine ? tasks.filter((task) => task.assigneeUserId === userId) : tasks
  const showResident = group === SHIFT_TASK_POLICY.board.defaultView
  const grouped = groupTasks(filtered, showResident ? 'room' : group, carriedOut)
  const allTasks = grouped.flatMap((entry) => entry.tasks)
  const groups = showResident && allTasks.length ? [{ key: 'all', label: 'Wszystkie zadania', tasks: allTasks }] : grouped

  return (
    <>
      <ShiftPlanApproval shiftDefinitionId={shiftId} shiftDate={date} version={approval?.version ?? null} stale={stale} canApprove={canSettle} printHref={canSettle && approval && !stale ? `/staff/shift-plan/print?shift=${shiftCode}&date=${date}` : null} />
      {voice.mfa && <FeatureFlagsMfa needsVerification={voice.mfa.needsVerification}
        description="Potwierdź drugi składnik uwierzytelniania, aby sprawdzić podpowiedzi z nagrań." />}
      {voice.unavailable && <ListError title="Nie udało się wczytać podpowiedzi z nagrań" />}
      {canSettle && (
        <Link className={navClass} href={`${qs({ closure: '1' })}#zamkniecie-zmiany`}>Zamknięcie zmiany</Link>
      )}
      <ShiftTaskForm key={`${shiftId}/${date}`} shiftDefinitionId={shiftId} shiftDate={date} residents={options}
        assignees={canSettle ? assignees : undefined}
        defaultResidentId={options.some((o) => o.id === residentParam) ? residentParam : undefined} />
      {groups.length === 0 ? (
        <ListEmpty title={mine ? 'Brak zadań przypisanych do Ciebie' : 'Brak zadań na tę zmianę'} />
      ) : (
        <ShiftTaskGroups groups={groups} shiftDate={date} canSettle={canSettle} targets={targets} assignees={assignees}
          evidenceByTask={evidenceByTask} showResident={showResident} />
      )}
      {canSettle && closure && (
        <ShiftHandoverReview supabase={supabase} shiftId={shiftId} date={date} tasks={tasks} auditPage={historyPage}
          auditPageHref={(page) => `${qs({ closure: '1', auditPage: String(page) })}#zamkniecie-zmiany`} />
      )}
    </>
  )
}
