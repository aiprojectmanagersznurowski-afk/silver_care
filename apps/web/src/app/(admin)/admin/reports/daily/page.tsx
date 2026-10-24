import { createClient } from '@/lib/supabase/server'
import { DailyReportClient } from '@/components/DailyReportClient'
import { PageHeader } from '@/components/patterns/PageHeader'

export default async function DailyReportPage() {
  const supabase = await createClient()

  // Get organization_id from current user
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = user?.app_metadata?.organization_id

  return (
    <div className="space-y-8">
      <PageHeader title="Dane Dzienne" description="Dzienny raport obłożenia, umów i zdarzeń w placówce." />

      <DailyReportClient organizationId={orgId} />
    </div>
  )
}
