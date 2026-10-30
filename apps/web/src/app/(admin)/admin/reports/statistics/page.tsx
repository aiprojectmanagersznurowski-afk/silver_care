import { createClient } from '@/lib/supabase/server'
import { StatisticsDashboardClient } from '@/components/StatisticsDashboardClient'
import { PageHeader } from '@/components/patterns/PageHeader'
import { getCurrentUser } from '@/lib/supabase/current-user'

export default async function StatisticsPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  const orgId = user?.app_metadata?.organization_id

  if (!orgId) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Brak przypisanej organizacji.
      </div>
    )
  }

  // Fetch all statistics data server-side
  const [
    { data: careLevelData },
    { data: occupancyKpi },
    { data: deathsByStay },
    { data: contractSources },
    { data: admissionsByMonth },
    { data: contractEndReasons },
  ] = await Promise.all([
    supabase.rpc('fn_care_level_stats', { p_org_id: orgId }),
    supabase.rpc('fn_occupancy_kpi', { p_org_id: orgId }),
    supabase.rpc('fn_deaths_by_stay_length', { p_org_id: orgId }),
    supabase.rpc('fn_contract_sources', { p_org_id: orgId }),
    supabase.rpc('fn_admissions_by_month_care_level', { p_org_id: orgId }),
    supabase.rpc('fn_contract_end_reasons', { p_org_id: orgId }),
  ])

  return (
    <div className="space-y-8">
      <PageHeader
        title="Statystyka"
        description="Podsumowanie i agregaty placówki — stany, obłożenie, przyjęcia, źródła umów."
      />

      <StatisticsDashboardClient
        careLevelData={careLevelData || []}
        occupancyKpi={Array.isArray(occupancyKpi) && occupancyKpi.length > 0 ? occupancyKpi[0] : null}
        deathsByStay={deathsByStay || []}
        contractSources={contractSources || []}
        admissionsByMonth={admissionsByMonth || []}
        contractEndReasons={contractEndReasons || []}
      />
    </div>
  )
}
