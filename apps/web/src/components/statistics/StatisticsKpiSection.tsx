import { Card, CardContent } from '@/components/ui/card'
import { Users, Bed, Heart, Activity, ShieldCheck } from 'lucide-react'

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

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  color?: string
}) {
  return (
    <Card className="rounded-xl border-none ring-1 ring-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        <p className={`text-xl font-bold tabular-nums ${color || 'text-foreground'}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

export function StatisticsKpiSection({
  occupancyKpi,
}: {
  occupancyKpi: OccupancyKpi | null
}) {
  if (!occupancyKpi) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
      <KpiCard icon={Users} label="Aktywni" value={occupancyKpi.active_residents} />
      <KpiCard icon={Bed} label="Łóżka" value={`${occupancyKpi.occupied_beds}/${occupancyKpi.total_beds}`} />
      <KpiCard
        icon={Activity}
        label="Obłożenie"
        value={`${occupancyKpi.occupancy_rate}%`}
      />
      <KpiCard icon={Bed} label="Wolne" value={occupancyKpi.free_beds} />
      <KpiCard
        icon={ShieldCheck}
        label="ZSN"
        value={`${occupancyKpi.zsn_count ?? 0} (${occupancyKpi.zsn_percentage ?? 0}%)`}
      />
      <KpiCard icon={Heart} label="Zgony (msc)" value={occupancyKpi.deaths_this_month} />
      <KpiCard
        icon={Users}
        label="Nowe umowy"
        value={occupancyKpi.contracts_signed_this_month}
      />
      <KpiCard
        icon={Users}
        label="Koniec umów"
        value={occupancyKpi.contracts_ended_this_month}
      />
      <KpiCard
        icon={Activity}
        label="Delta (msc)"
        value={
          occupancyKpi.contracts_signed_this_month -
          occupancyKpi.contracts_ended_this_month -
          occupancyKpi.deaths_this_month
        }
      />
    </div>
  )
}
