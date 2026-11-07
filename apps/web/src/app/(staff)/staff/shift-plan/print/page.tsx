import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { getAppRole } from '@/lib/auth/app-role'
import { PageHeader } from '@/components/patterns/PageHeader'
import { ListEmpty } from '@/components/patterns/ListState'
import { PrintPlanButton } from '@/components/shifts/PrintPlanButton'
import { formatDayLabel, normalizeDateParam } from '@/lib/shifts/roster-week'
import { formatShiftRange, trimSeconds } from '@/lib/shifts/shift-definitions'
import { loadShiftTaskData } from '@/lib/shifts/shift-tasks-data'
import { buildPrintSections } from '@/lib/shifts/shift-plan-print'
import { groupTasks } from '@/lib/shifts/shift-tasks-view'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ shift?: string; date?: string }>

/** Plan pracy zmiany do wydruku A4 (NUR-SHIFT-PLAN-PRINT, SC-NUR-16): tylko zatwierdzony plan, pola bez PESEL i kontaktów. */
export default async function ShiftPlanPrintPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser()
  const role = getAppRole(user)
  if (!user || (role !== 'nurse' && role !== 'org_admin')) redirect('/')

  const params = await searchParams
  const date = normalizeDateParam(params.date)
  const supabase = await createClient()
  const { data: shift } = await supabase
    .from('shift_definitions')
    .select('id, name, start_time, end_time')
    .eq('code', params.shift ?? '')
    .eq('is_active', true)
    .maybeSingle()
  if (!shift) return <ListEmpty title="Nie znaleziono zmiany" description="Wróć do listy zadań i wybierz zmianę." />

  const [leadRes, approvalsRes] = await Promise.all([
    role === 'org_admin' ? Promise.resolve({ data: true }) : supabase.rpc('is_shift_lead', { p_shift_definition_id: shift.id, p_shift_date: date }),
    supabase.from('shift_plan_approvals').select('version').eq('shift_definition_id', shift.id).eq('shift_date', date),
  ])
  if (leadRes.data !== true) return <ListEmpty title="Brak uprawnień" description="Plan pracy drukuje kierownik zmiany." />
  if (!(approvalsRes.data ?? []).length) {
    return <ListEmpty title="Najpierw zatwierdź plan zmiany" description="Wydruk jest możliwy po zatwierdzeniu planu na liście zadań." />
  }

  const { tasks, carriedOut } = await loadShiftTaskData(supabase, shift.id, date)
  const visible = groupTasks(tasks, 'room', carriedOut).flatMap((g) => g.tasks)
  const sections = buildPrintSections(visible)

  return (
    <div className="space-y-6">
      <style>{'@media print { @page { size: A4; margin: 12mm } header, [data-slot^="sidebar"] { display: none !important } }'}</style>
      <PageHeader
        title="Plan pracy zmiany"
        description={`${formatDayLabel(date)} · ${shift.name}, ${formatShiftRange(trimSeconds(shift.start_time), trimSeconds(shift.end_time))}`}
        actions={<PrintPlanButton shiftDefinitionId={shift.id} shiftDate={date} />}
      />
      {sections.length === 0 ? (
        <ListEmpty title="Brak zadań do wydruku" description="Na tej zmianie nie ma zadań ze statusem „Do zrobienia”." />
      ) : (
        sections.map((section) => (
          <section key={section.heading} className="break-inside-avoid space-y-2">
            <h2 className="text-sm font-semibold text-foreground">{section.heading}</h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1 pr-2">Podopieczny</th><th className="py-1 pr-2">Zadanie</th><th className="py-1 pr-2">Godzina</th>
                  <th className="py-1 pr-2">Źródło</th><th className="py-1">Wykonano</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, i) => (
                  <tr key={i} className="border-b align-top">
                    <td className="py-1 pr-2">{row.resident}{row.place && <span className="block text-xs text-muted-foreground">{row.place}</span>}</td>
                    <td className="py-1 pr-2">{row.title}</td>
                    <td className="py-1 pr-2">{row.dueTime || '—'}</td>
                    <td className="py-1 pr-2">{row.source}</td>
                    <td className="py-1"><span aria-hidden>☐</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  )
}
