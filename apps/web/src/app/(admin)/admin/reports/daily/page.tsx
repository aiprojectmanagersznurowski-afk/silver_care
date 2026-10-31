import { DailyReportClient } from '@/components/DailyReportClient'
import { PageHeader } from '@/components/patterns/PageHeader'
import { getCurrentUser } from '@/lib/supabase/current-user'

export default async function DailyReportPage() {

  // Get organization_id from current user
  const user = await getCurrentUser()
  const orgId = user?.app_metadata?.organization_id

  return (
    <div className="space-y-8">
      <PageHeader title="Dane Dzienne" description="Dzienny raport obłożenia, umów i zdarzeń w placówce." />

      <DailyReportClient organizationId={orgId} />
    </div>
  )
}
