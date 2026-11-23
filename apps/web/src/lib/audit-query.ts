import { SHIFT_TASK_POLICY } from '@silvercare/contracts/src/generated/facility'
import { SHIFT_TASK_VOICE } from '@silvercare/contracts/src/generated/roles'
import { RESIDENT_ASSIGNMENT } from '@silvercare/contracts/src/generated/voice'
import type { ApiAuthContext } from '@/lib/api-auth'
import { auditDayBoundary, parseAuditDate } from '@/lib/audit-helpers'

export function getAuditFilter(params: { startDate?: string; endDate?: string; scope?: string }) {
  const startDate = parseAuditDate(params.startDate)
  const endDate = parseAuditDate(params.endDate)
  const scope = params.scope === 'shift' ? 'shift' as const : 'all' as const
  const invalidDate = (params.startDate && !startDate) || (params.endDate && !endDate)
  const invalidOrder = startDate && endDate && startDate > endDate
  const filterError = invalidDate ? 'Podaj poprawny zakres dat.'
    : invalidOrder ? 'Data początkowa musi poprzedzać końcową lub być taka sama.' : undefined
  return { startDate, endDate, scope, filterError }
}

export function buildAuditQuery(supabase: ApiAuthContext['supabase'], filter: ReturnType<typeof getAuditFilter>) {
  let query = supabase.from('audit_logs')
    .select('id, organization_id, action, performed_by, payload, created_at')
    .order('created_at', { ascending: false }).order('id', { ascending: false })
  if (filter.startDate) query = query.gte('created_at', auditDayBoundary(filter.startDate))
  if (filter.endDate) query = query.lt('created_at', auditDayBoundary(filter.endDate, true))
  if (filter.scope === 'shift') {
    const { events, historicalEvents, voiceEvents } = SHIFT_TASK_POLICY.closure.audit
    query = query.in('action', [
      ...SHIFT_TASK_POLICY.audit, ...events, ...historicalEvents, ...voiceEvents,
      SHIFT_TASK_VOICE.auditAction, ...RESIDENT_ASSIGNMENT.sourceReview.auditActions,
    ])
  }
  return query
}
