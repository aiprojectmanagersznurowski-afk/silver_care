export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { AuditManagementClient } from '@/components/AuditManagementClient'
import { buildAuditQuery, getAuditFilter } from '@/lib/audit-query'
import { PageHeader } from '@/components/patterns/PageHeader'
import { ListError } from '@/components/patterns/ListState'

const PAGE_SIZE = 200

type AuditParams = { startDate?: string; endDate?: string; scope?: string; page?: string }

export default async function AdminAuditPage({ searchParams }: { searchParams?: Promise<AuditParams> }) {
  const params = searchParams ? await searchParams : {}
  const filter = getAuditFilter(params)
  const { startDate, endDate, scope, filterError } = filter
  const pageNumber = Number(params.page)
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 && pageNumber <= 1_000_000 ? pageNumber : 1
  const supabase = await createClient()
  const query = buildAuditQuery(supabase, filter)
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
