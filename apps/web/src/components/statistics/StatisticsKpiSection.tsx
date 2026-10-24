import { Users, Bed, Heart, Activity, ShieldCheck, FileSignature, FileX, BedDouble } from 'lucide-react'
import { MetricCard, MetricGrid } from '@/components/patterns/MetricCard'

export interface OccupancyKpi {
  total_beds: number
  occupied_beds: number
  free_beds: number
  occupancy_rate: number
  active_residents: number
  zsn_count: number
  zsn_percentage: number
  deaths_this_month: number
  contracts_signed_this_month: number
  contracts_ended_this_month: number
}

export function StatisticsKpiSection({
  occupancyKpi,
}: {
  occupancyKpi: OccupancyKpi | null
}) {
  if (!occupancyKpi) return null

  return (
    <MetricGrid>
      <MetricCard icon={<Users />} label="Aktywni" value={occupancyKpi.active_residents} />
      <MetricCard icon={<Bed />} label="Łóżka zajęte" value={`${occupancyKpi.occupied_beds}/${occupancyKpi.total_beds}`} />
      <MetricCard icon={<Activity />} label="Obłożenie" value={`${occupancyKpi.occupancy_rate}%`} />
      <MetricCard icon={<BedDouble />} label="Wolne łóżka" value={occupancyKpi.free_beds} />
      <MetricCard icon={<ShieldCheck />} label="ZSN" value={occupancyKpi.zsn_count ?? 0} description={`${occupancyKpi.zsn_percentage ?? 0}% podopiecznych`} />
      <MetricCard icon={<Heart />} label="Zgony (miesiąc)" value={occupancyKpi.deaths_this_month} />
      <MetricCard icon={<FileSignature />} label="Nowe umowy (miesiąc)" value={occupancyKpi.contracts_signed_this_month} />
      <MetricCard icon={<FileX />} label="Koniec umów (miesiąc)" value={occupancyKpi.contracts_ended_this_month} />
      <MetricCard
        icon={<Activity />}
        label="Zmiana netto (miesiąc)"
        value={occupancyKpi.contracts_signed_this_month - occupancyKpi.contracts_ended_this_month - occupancyKpi.deaths_this_month}
        description="Nowe umowy minus zakończone umowy i zgony."
      />
    </MetricGrid>
  )
}
