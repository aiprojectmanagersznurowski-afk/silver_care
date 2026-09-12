import { createClient } from '@/lib/supabase/server'
import { DailyReportClient } from '@/components/DailyReportClient'

export default async function DailyReportPage() {
  const supabase = await createClient()

  // Get organization_id from current user
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = user?.app_metadata?.organization_id

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-semibold tracking-tight text-slate">
          Dane Dzienne
        </h2>
        <p className="mt-2 text-slate-soft">
          Dzienny raport obłożenia, umów i zdarzeń w placówce.
        </p>
      </div>

      <DailyReportClient organizationId={orgId} />
    </div>
  )
}
