export const dynamic = 'force-dynamic'

import { SHIFT_TASK_POLICY } from '@silvercare/contracts/src/generated/facility'
import { createClient } from '@/lib/supabase/server'
import { AuditManagementClient } from '@/components/AuditManagementClient'
import { auditDayBoundary, parseAuditDate } from '@/lib/audit-helpers'
import { PageHeader } from '@/components/patterns/PageHeader'
import { ListError } from '@/components/patterns/ListState'

const PAGE_SIZE = 200

type AuditParams = { startDate?: string; endDate?: string; scope?: string; page?: string }

export default async function AdminAuditPage({ searchParams }: { searchParams?: Promise<AuditParams> }) {
  const params = searchParams ? await searchParams : {}
  const startDate = parseAuditDate(params.startDate)
  const endDate = parseAuditDate(params.endDate)
  const scope = params.scope === 'shift' ? 'shift' : 'all'
  const pageNumber = Number(params.page)
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 && pageNumber <= 1_000_000 ? pageNumber : 1
  const invalidDate = (params.startDate && !startDate) || (params.endDate && !endDate)
  const invalidOrder = startDate && endDate && startDate > endDate
  const filterError = invalidDate ? 'Podaj poprawny zakres dat.' : invalidOrder ? 'Data początkowa musi poprzedzać końcową lub być taka sama.' : undefined

  const supabase = await createClient()
  // RLS ogranicza rejestr do istniejących uprawnień kierownika placówki i superadministratora.
  let query = supabase.from('audit_logs')
    .select('id, organization_id, action, performed_by, payload, created_at')
    .order('created_at', { ascending: false }).order('id', { ascending: false })
  if (startDate) query = query.gte('created_at', auditDayBoundary(startDate))
  if (endDate) query = query.lt('created_at', auditDayBoundary(endDate, true))
  if (scope === 'shift') {
    query = query.in('action', [...SHIFT_TASK_POLICY.audit, ...SHIFT_TASK_POLICY.closure.audit.events, ...SHIFT_TASK_POLICY.closure.audit.voiceEvents])
  }
  const offset = (page - 1) * PAGE_SIZE
  const { data: logs, error } = filterError ? { data: [], error: null } : await query.range(offset, offset + PAGE_SIZE)
  if (error) console.error('[AUDIT_QUERY_FAILED]', error.code)

  return (
    <div className="space-y-6">
      <PageHeader title="Rejestr audytowy" />
      {error && <ListError title="Nie udało się wczytać rejestru audytowego" />}
      <AuditManagementClient
        key={`${scope}|${startDate}|${endDate}|${page}`}
        initialLogs={logs?.slice(0, PAGE_SIZE) ?? []}
        initialStartDate={startDate}
        initialEndDate={endDate}
        initialScope={scope}
        page={page}
        hasNext={(logs?.length ?? 0) > PAGE_SIZE}
        filterError={filterError}
      />
    </div>
  )
}
