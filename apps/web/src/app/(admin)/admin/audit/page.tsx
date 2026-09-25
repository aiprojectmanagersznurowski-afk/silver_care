export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { AuditManagementClient } from '@/components/AuditManagementClient'
import { AuditLogEntry } from '@/lib/audit-helpers'

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: Promise<{ startDate?: string; endDate?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const supabase = await createClient()

  // Pobieranie audytu z tabeli audit_logs (izolowane przez RLS)
  let query = supabase
    .from('audit_logs')
    .select('id, organization_id, action, performed_by, payload, created_at')
    .order('created_at', { ascending: false })

  if (params.startDate) {
    query = query.gte('created_at', new Date(params.startDate).toISOString())
  }
  if (params.endDate) {
    const end = new Date(params.endDate)
    end.setHours(23, 59, 59, 999)
    query = query.lte('created_at', end.toISOString())
  }

  const { data: logs, error } = await query.limit(1000)

  if (error) {
    console.error('Błąd pobierania rejestru audytowego:', error.message)
  }

  const initialLogs: AuditLogEntry[] = (logs || []).map(l => ({
    id: l.id,
    organization_id: l.organization_id,
    action: l.action,
    performed_by: l.performed_by,
    created_at: l.created_at,
    payload: l.payload
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-semibold tracking-tight text-slate">
          Rejestr Audytowy
        </h2>
        <p className="mt-2 text-slate-soft">
          Wgląd w logi bezpieczeństwa i akcji systemowych z filtrowaniem wg dat, strefą czasową i eksportem RODO.
        </p>
      </div>

      <AuditManagementClient initialLogs={initialLogs} />
    </div>
  )
}
