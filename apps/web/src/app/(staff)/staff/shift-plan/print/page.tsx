import Link from 'next/link'
import { requireOrgFeature } from '@/lib/feature-flags'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { getAppOrganizationId, getAppRole } from '@/lib/auth/app-role'
import { PageHeader } from '@/components/patterns/PageHeader'
import { ListEmpty, ListError } from '@/components/patterns/ListState'
import { TableCard } from '@/components/patterns/TableCard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PrintPlanButton } from '@/components/shifts/PrintPlanButton'
import { normalizeDateParam } from '@/lib/shifts/roster-week'
import { formatShiftRange, trimSeconds } from '@/lib/shifts/shift-definitions'
import { loadShiftTaskData } from '@/lib/shifts/shift-tasks-data'
import { buildPrintSections } from '@/lib/shifts/shift-plan-print'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ shift?: string; date?: string; groupBy?: string }>

const planDate = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long', timeZone: 'UTC' })

const printStyles = `
  @media print {
    @page { size: A4; margin: 12mm; }
    body:has([data-shift-plan-print]) { color-scheme: light; background: Canvas; }
    body:has([data-shift-plan-print]) :is([data-slot="sidebar"], [data-slot="page-header-back"]),
    [data-slot="sidebar-inset"]:has([data-shift-plan-print]) > :not(:has([data-shift-plan-print])),
    [data-shift-plan-print]:not(:has([data-audited-print])) { display: none !important; }
    [data-slot="sidebar-wrapper"]:has([data-shift-plan-print]),
    [data-slot="sidebar-inset"]:has([data-shift-plan-print]),
    [data-slot="sidebar-inset"] :has(> [data-shift-plan-print]),
    [data-slot="sidebar-inset"] > :has([data-shift-plan-print]) {
      display: block;
      min-height: 0;
      max-width: none;
      margin: 0;
      padding: 0;
      overflow: visible;
      box-shadow: none;
      background: transparent;
    }
    [data-shift-plan-print] * { color: CanvasText !important; background: transparent !important; }
    [data-shift-plan-print] :is([data-slot="page-header"], [data-slot="page-header-actions"]) { display: block; }
    [data-shift-plan-print] :is([data-slot="page-header"], footer, tr) { break-inside: avoid; }
    [data-shift-plan-print] :is([data-slot="table-card"], [data-slot="table-container"]) { overflow: visible; }
    [data-shift-plan-print] [data-slot="table-card"] { border: 0; border-radius: 0; }
    [data-shift-plan-print] [data-slot="table-card-header"] { padding: 0 0 0.25em; border: 0; break-after: avoid; }
    [data-shift-plan-print] table { table-layout: fixed; min-width: 0; border-collapse: collapse; }
    [data-shift-plan-print] thead { display: table-header-group; break-inside: avoid; }
    [data-shift-plan-print] :is(tr, th, td) { height: auto; border-color: GrayText; }
    [data-shift-plan-print] :is(th, td) { padding: 0.3em 0.45em; overflow-wrap: anywhere; }
  }
`

/** Plan pracy zmiany do wydruku A4 (NUR-SHIFT-PLAN-PRINT, SC-NUR-15). */
export default async function ShiftPlanPrintPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await requireOrgFeature('module_shift_tasks')).allowed) return <FeatureDisabledState />

  const user = await getCurrentUser()
  const role = getAppRole(user)
  const organizationId = getAppOrganizationId(user)
  if (!user || !organizationId || (role !== 'nurse' && role !== 'org_admin')) redirect('/')

  const params = await searchParams
  const date = normalizeDateParam(params.date)
  const groupBy = params.groupBy === 'resident' ? params.groupBy : 'room'
  const supabase = await createClient()
  const { data: shift } = await supabase
    .from('shift_definitions')
    .select('id, code, name, start_time, end_time')
    .eq('organization_id', organizationId)
    .eq('code', params.shift ?? '')
    .eq('is_active', true)
    .maybeSingle()
  if (!shift) return <ListEmpty title="Nie znaleziono zmiany" description="Wróć do listy zadań i wybierz zmianę." />

  const [leadRes, approvalRes] = await Promise.all([
    role === 'org_admin' ? Promise.resolve({ data: true }) : supabase.rpc('is_shift_lead', { p_shift_definition_id: shift.id, p_shift_date: date }),
    supabase.rpc('get_shift_plan_status', { p_shift: shift.id, p_date: date }).maybeSingle(),
  ])
  if (leadRes.data !== true) return <ListEmpty title="Brak uprawnień" description="Plan pracy drukuje kierownik zmiany." />
  if (approvalRes.error) return <ListError title="Nie udało się wczytać zatwierdzonego planu" />
  const returnQuery = new URLSearchParams({ shift: shift.code, date, group: groupBy })
  const returnHref = `/staff/shift-tasks?${returnQuery}`
  const returnLabel = 'Wróć do listy zadań'
  const returnLink = <Link href={returnHref} className="inline-flex min-h-touch min-w-touch items-center text-sm underline">{returnLabel}</Link>
  const approval = approvalRes.data
  if (!approval) {
    return <ListEmpty title="Najpierw zatwierdź plan zmiany" description="Wydruk jest możliwy po zatwierdzeniu planu na liście zadań." action={returnLink} />
  }

  if (approval.stale) {
    return <ListEmpty title="Plan wymaga ponownego zatwierdzenia" description="Zatwierdź aktualną wersję planu na liście zadań." action={returnLink} />
  }
  const [{ tasks, carriedOut, unavailable }, { data: organization, error: organizationError }] = await Promise.all([
    loadShiftTaskData(supabase, shift.id, date),
    supabase.from('organizations').select('name').eq('id', organizationId).maybeSingle(),
  ])
  if (unavailable) return <ListError title="Nie udało się wczytać zadań z zatwierdzonego planu" />
  if (organizationError || !organization) return <ListError title="Nie udało się wczytać nazwy placówki" />
  const sections = buildPrintSections(tasks, groupBy, carriedOut)
  const shiftRange = formatShiftRange(trimSeconds(shift.start_time), trimSeconds(shift.end_time))

  return (
    <div data-shift-plan-print className="space-y-6">
      <style>{printStyles}</style>
      <PageHeader
        title="Plan pracy zmiany"
        description={`Data planu ${planDate.format(new Date(date))} · ${shift.name}, ${shiftRange} · Wersja ${approval.version}`}
        back={{ href: returnHref, label: returnLabel }}
        actions={<PrintPlanButton key={`${shift.id}/${date}/${approval.version}/${groupBy}`} shiftDefinitionId={shift.id} shiftDate={date} planVersion={approval.version} />}
      />
      <p className="text-sm font-semibold">{organization.name}</p>
      {sections.length === 0 ? (
        <ListEmpty title="Brak zadań do wydruku" description="Na tej zmianie nie ma zadań ze statusem „Do zrobienia”." />
      ) : (
        sections.map((section, index) => (
          <TableCard key={index} title={section.heading}>
            <Table className="min-w-[650px]">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="w-[19%]">Podopieczny</TableHead>
                  <TableHead scope="col" className="w-[36%]">Zadanie</TableHead>
                  <TableHead scope="col" className="w-[9%]">Godzina</TableHead>
                  <TableHead scope="col" className="w-[12%]">Źródło</TableHead>
                  <TableHead scope="col" className="w-[12%]">Przypisanie</TableHead>
                  <TableHead scope="col" className="w-[12%]">Wykonano</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.rows.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    <TableCell className="align-top whitespace-normal">
                      {row.resident}{row.place && <span className="block text-xs text-muted-foreground">{row.place}</span>}
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">{row.title}</TableCell>
                    <TableCell className="align-top">{row.dueTime || '—'}</TableCell>
                    <TableCell className="align-top whitespace-normal">{row.source}</TableCell>
                    <TableCell className="align-top whitespace-normal">{row.assignee}</TableCell>
                    <TableCell className="align-top"><span aria-hidden className="inline-block size-4 border border-current" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        ))
      )}
      <footer className="space-y-4 text-sm">
        <p className="w-fit">
          <span aria-hidden className="mb-1 block h-6 w-full min-w-48 border-b border-current" />
          Podpis kierownika zmiany
        </p>
        <p>Dokument wewnętrzny placówki — nie przekazywać osobom trzecim</p>
      </footer>
    </div>
  )
}
