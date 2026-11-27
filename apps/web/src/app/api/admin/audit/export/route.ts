import { NextResponse } from 'next/server'
import { SHIFT_POLICY } from '@silvercare/contracts/src/generated/facility'
import { withAuth } from '@/lib/api-auth'
import { formatAuditToCsv, formatAuditToJson, type AuditLogEntry } from '@/lib/audit-helpers'
import { buildAuditQuery, getAuditFilter } from '@/lib/audit-query'
import { todayWarsaw } from '@/lib/shifts/roster-week'

const PAGE_SIZE = 200
const NO_CACHE = { 'Cache-Control': 'private, no-store' }

/** @REQ: NUR-SHIFT-CLOSURE @REQ: SEC-AUDIT-APPEND-ONLY */
export const GET = withAuth(async (request, { supabase }) => {
  const query = request.nextUrl.searchParams
  const format = query.get('format')
  const filter = getAuditFilter({
    startDate: query.get('startDate') ?? undefined,
    endDate: query.get('endDate') ?? undefined,
    scope: query.get('scope') ?? undefined,
  })
  if (filter.filterError || (format !== 'csv' && format !== 'json')) {
    return NextResponse.json({ error: filter.filterError ?? 'Wybierz format CSV albo JSON.' }, { status: 400, headers: NO_CACHE })
  }

  const cutoff = new Date().toISOString()
  const csv = format === 'csv'
  const encoder = new TextEncoder()
  const fetchPage = async (after?: Pick<AuditLogEntry, 'created_at' | 'id'>) => {
    let rows = buildAuditQuery(supabase, filter).lte('created_at', cutoff).limit(PAGE_SIZE).abortSignal(request.signal)
    if (after) rows = rows.or(`created_at.lt.${after.created_at},and(created_at.eq.${after.created_at},id.lt.${after.id})`)
    return rows
  }

  const initial = await fetchPage()
  if (initial.error) {
    console.error('[AUDIT_EXPORT_FAILED]', initial.error.code)
    return NextResponse.json({ error: 'Nie udało się wyeksportować rejestru.' }, { status: 503, headers: NO_CACHE })
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let page: AuditLogEntry[] = initial.data ?? []
      let first = true
      try {
        if (!csv) controller.enqueue(encoder.encode('['))
        while (true) {
          if (csv) {
            const text = formatAuditToCsv(page, SHIFT_POLICY.timezone)
            if (first) controller.enqueue(encoder.encode(text))
            else if (page.length) controller.enqueue(encoder.encode(text.slice(text.indexOf('\n'))))
          } else if (page.length) {
            const items = formatAuditToJson(page, SHIFT_POLICY.timezone).slice(1, -1).trim()
            controller.enqueue(encoder.encode((first ? '' : ',\n') + items))
          }
          if (page.length < PAGE_SIZE) break
          first = false
          const next = await fetchPage(page[page.length - 1])
          if (next.error) throw new Error(next.error.code)
          page = next.data ?? []
        }
        if (!csv) controller.enqueue(encoder.encode(']'))
        controller.close()
      } catch {
        controller.error(new Error('AUDIT_EXPORT_INTERRUPTED'))
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      ...NO_CACHE,
      'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-rodo-export-${todayWarsaw()}.${format}"`,
    },
  })
}, { roles: ['org_admin', 'super_admin'], requireOrganization: true, blockImpersonation: true })
