'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users, Bed, Heart, Activity,
  BarChart3, PieChart, ShieldCheck
} from 'lucide-react'
import {
  CARE_LEVEL_LABELS, CARE_LEVEL_COLORS,
  CONTRACT_END_REASON_LABELS, CONTRACT_SOURCE_LABELS,
  MONTH_LABELS_SHORT_PL, STAY_RANGE_ORDER,
  type CareLevel, type ContractSource, type ContractEndReason,
} from '@/lib/reporting-constants'
import { ResponsivePie } from '@nivo/pie'
import { ResponsiveBar } from '@nivo/bar'

// ── Types ───────────────────────────────────────────────────────────────────

interface CareLevelStat {
  care_level: string
  resident_count: number
}

interface OccupancyKpi {
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

interface DeathsByStay {
  stay_range: string
  cnt: number
}

interface ContractSourceStat {
  source: string
  cnt: number
}

interface AdmissionByMonth {
  admission_month: number
  care_level: string
  cnt: number
}

interface ContractEndReasonStat {
  end_reason: string
  event_month: number
  cnt: number
}

interface Props {
  careLevelData: CareLevelStat[]
  occupancyKpi: OccupancyKpi | null
  deathsByStay: DeathsByStay[]
  contractSources: ContractSourceStat[]
  admissionsByMonth: AdmissionByMonth[]
  contractEndReasons: ContractEndReasonStat[]
}

// ── Nivo Theme (using design system tokens) ─────────────────────────────────

const nivoTheme = {
  text: {
    fontSize: 11,
    fill: 'var(--color-slate-soft)',
    fontFamily: 'inherit',
  },
  axis: {
    ticks: {
      text: { fontSize: 10, fill: 'var(--color-slate-soft)' },
    },
    legend: {
      text: { fontSize: 12, fill: 'var(--color-slate-soft)' },
    },
  },
  grid: {
    line: { stroke: 'var(--color-border)', strokeWidth: 1 },
  },
  tooltip: {
    container: {
      background: 'var(--color-card)',
      color: 'var(--color-foreground)',
      fontSize: 12,
      borderRadius: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      padding: '8px 12px',
      border: '1px solid var(--color-border)',
    },
  },
  labels: {
    text: { fontSize: 11, fontWeight: 600 as const },
  },
}

const END_REASON_COLORS = [
  'var(--color-primary)',
  'var(--color-accent-foreground)',
  'var(--color-slate-soft)',
  'var(--color-destructive)',
  'var(--color-border)',
  'var(--color-sage-deep)',
]

// ── Component ───────────────────────────────────────────────────────────────

export function StatisticsDashboardClient({
  careLevelData,
  occupancyKpi,
  deathsByStay,
  contractSources,
  admissionsByMonth,
  contractEndReasons,
}: Props) {
  // Transform data for Nivo pie
  const pieData = careLevelData.map((d) => ({
    id: CARE_LEVEL_LABELS[(d.care_level || 'unknown') as CareLevel | 'unknown'] || d.care_level,
    label: CARE_LEVEL_LABELS[(d.care_level || 'unknown') as CareLevel | 'unknown'] || d.care_level,
    value: d.resident_count,
    color: CARE_LEVEL_COLORS[(d.care_level || 'unknown') as CareLevel | 'unknown'],
  }))

  const totalResidents = careLevelData.reduce((sum, d) => sum + d.resident_count, 0)

  // Deaths by stay — bar chart data
  const deathsBarData = STAY_RANGE_ORDER.map(range => {
    const found = deathsByStay.find(d => d.stay_range === range)
    return { range, count: found ? found.cnt : 0 }
  })

  // Contract sources — horizontal bar
  const sourcesBarData = contractSources.map(d => ({
    source: CONTRACT_SOURCE_LABELS[d.source as ContractSource] || d.source,
    count: d.cnt,
  }))

  // Contract end reasons — pie chart
  const endReasonsPie = Object.entries(
    contractEndReasons.reduce<Record<string, number>>((acc, d) => {
      const label = CONTRACT_END_REASON_LABELS[d.end_reason as keyof typeof CONTRACT_END_REASON_LABELS] || d.end_reason
      acc[label] = (acc[label] || 0) + d.cnt
      return acc
    }, {})
  ).map(([id, value]) => ({ id, label: id, value }))

  // Admissions by month — stacked bar
  const admissionsData = Array.from({ length: 12 }, (_, i) => {
    const monthData: Record<string, string | number> = {
      month: MONTH_LABELS_SHORT_PL[i],
    }
    const monthEntries = admissionsByMonth.filter(d => d.admission_month === i + 1)
    for (const entry of monthEntries) {
      const label = CARE_LEVEL_LABELS[(entry.care_level || 'unknown') as CareLevel | 'unknown'] || entry.care_level
      monthData[label] = entry.cnt
    }
    return monthData
  }).filter(d => {
    // Only show months with data
    return Object.keys(d).some(k => k !== 'month' && (d[k] as number) > 0)
  })

  const admissionKeys = [...new Set(
    admissionsByMonth.map(d =>
      CARE_LEVEL_LABELS[(d.care_level || 'unknown') as CareLevel | 'unknown'] || d.care_level
    )
  )]

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      {occupancyKpi && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
          <KpiCard icon={Users} label="Aktywni" value={occupancyKpi.active_residents} />
          <KpiCard icon={Bed} label="Łóżka" value={`${occupancyKpi.occupied_beds}/${occupancyKpi.total_beds}`} />
          <KpiCard
            icon={Activity}
            label="Obłożenie"
            value={`${occupancyKpi.occupancy_rate}%`}
            color={occupancyKpi.occupancy_rate > 90 ? 'text-emerald-600' : 'text-slate'}
          />
          <KpiCard icon={Bed} label="Wolne" value={occupancyKpi.free_beds} />
          <KpiCard
            icon={ShieldCheck}
            label="ZSN"
            value={`${occupancyKpi.zsn_count ?? 0} (${occupancyKpi.zsn_percentage ?? 0}%)`}
            color="text-amber-700"
          />
          <KpiCard icon={Heart} label="Zgony (msc)" value={occupancyKpi.deaths_this_month} color="text-red-500" />
          <KpiCard
            icon={Users}
            label="Nowe umowy"
            value={occupancyKpi.contracts_signed_this_month}
            color="text-emerald-600"
          />
          <KpiCard
            icon={Users}
            label="Koniec umów"
            value={occupancyKpi.contracts_ended_this_month}
            color="text-amber-600"
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
      )}

      {/* Charts Row 1: Care Level + Contract End Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Care Level Breakdown */}
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate">
              <PieChart className="h-5 w-5 text-sage" /> Stan podopiecznych
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-slate-soft text-center py-12">Brak danych</p>
            ) : (
              <>
                <div className="h-64">
                  <ResponsivePie
                    data={pieData}
                    colors={pieData.map(d => d.color)}
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    innerRadius={0.55}
                    padAngle={2}
                    cornerRadius={4}
                    activeOuterRadiusOffset={8}
                    enableArcLinkLabels={false}
                    arcLabelsSkipAngle={15}
                    arcLabelsTextColor="var(--color-primary-foreground)"
                    theme={nivoTheme}
                    motionConfig="gentle"
                  />
                </div>
                {/* Legend */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {pieData.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 text-sm">
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="text-slate-soft">{d.label}</span>
                      <span className="ml-auto font-semibold text-slate tabular-nums">{d.value}</span>
                    </div>
                  ))}
                  <div className="col-span-2 border-t border-slate/10 pt-2 mt-1 flex items-center justify-between text-sm font-semibold">
                    <span className="text-slate">Razem</span>
                    <span className="text-slate tabular-nums">{totalResidents}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Contract End Reasons */}
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate">
              <PieChart className="h-5 w-5 text-sage" /> Powody zakończenia umowy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {endReasonsPie.length === 0 ? (
              <p className="text-sm text-slate-soft text-center py-12">Brak danych</p>
            ) : (
              <div className="h-80">
                <ResponsivePie
                  data={endReasonsPie}
                  margin={{ top: 20, right: 100, bottom: 20, left: 20 }}
                  innerRadius={0.5}
                  padAngle={2}
                  cornerRadius={4}
                  activeOuterRadiusOffset={8}
                  enableArcLinkLabels={true}
                  arcLinkLabelsSkipAngle={10}
                  arcLinkLabelsTextColor="var(--color-slate-soft)"
                  arcLinkLabelsColor={{ from: 'color' }}
                  arcLabelsSkipAngle={15}
                  arcLabelsTextColor="var(--color-primary-foreground)"
                  theme={nivoTheme}
                  colors={END_REASON_COLORS}
                  motionConfig="gentle"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Deaths by Stay + Contract Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deaths by stay length */}
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate">
              <BarChart3 className="h-5 w-5 text-sage" /> Zgony a długość pobytu
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deathsBarData.every(d => d.count === 0) ? (
              <p className="text-sm text-slate-soft text-center py-12">Brak danych</p>
            ) : (
              <div className="h-72">
                <ResponsiveBar
                  data={deathsBarData}
                  keys={['count']}
                  indexBy="range"
                  margin={{ top: 10, right: 20, bottom: 50, left: 40 }}
                  padding={0.3}
                  colors={['var(--color-slate-soft)']}
                  borderRadius={4}
                  enableLabel={true}
                  labelTextColor="var(--color-primary-foreground)"
                  axisBottom={{
                    tickRotation: -30,
                  }}
                  theme={nivoTheme}
                  motionConfig="gentle"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contract Sources */}
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate">
              <BarChart3 className="h-5 w-5 text-sage" /> Źródło umowy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sourcesBarData.length === 0 ? (
              <p className="text-sm text-slate-soft text-center py-12">Brak danych</p>
            ) : (
              <div className="h-72">
                <ResponsiveBar
                  data={sourcesBarData}
                  keys={['count']}
                  indexBy="source"
                  layout="horizontal"
                  margin={{ top: 10, right: 30, bottom: 20, left: 120 }}
                  padding={0.3}
                  colors={['var(--color-primary)']}
                  borderRadius={4}
                  enableLabel={true}
                  labelTextColor="var(--color-primary-foreground)"
                  theme={nivoTheme}
                  motionConfig="gentle"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Admissions by Month */}
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-slate">
            <BarChart3 className="h-5 w-5 text-sage" /> Przyjęcia wg miesiąca i stanu
          </CardTitle>
        </CardHeader>
        <CardContent>
          {admissionsData.length === 0 ? (
            <p className="text-sm text-slate-soft text-center py-12">Brak danych</p>
          ) : (
            <div className="h-80">
              <ResponsiveBar
                data={admissionsData}
                keys={admissionKeys}
                indexBy="month"
                groupMode="stacked"
                margin={{ top: 20, right: 140, bottom: 40, left: 40 }}
                padding={0.3}
                colors={admissionKeys.map(k => {
                  const entry = Object.entries(CARE_LEVEL_LABELS).find(([, v]) => v === k)
                  return entry ? CARE_LEVEL_COLORS[entry[0] as CareLevel | 'unknown'] : 'var(--color-slate-soft)'
                })}
                borderRadius={3}
                enableLabel={false}
                axisBottom={{
                  tickRotation: 0,
                }}
                legends={[
                  {
                    dataFrom: 'keys',
                    anchor: 'right',
                    direction: 'column',
                    translateX: 130,
                    itemWidth: 120,
                    itemHeight: 20,
                    symbolSize: 12,
                    symbolShape: 'circle',
                  },
                ]}
                theme={nivoTheme}
                motionConfig="gentle"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── KPI Card ────────────────────────────────────────────────────────────────

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
    <Card className="rounded-xl border-none shadow-sm ring-1 ring-slate/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-slate-soft" />
          <span className="text-xs font-medium text-slate-soft">{label}</span>
        </div>
        <p className={`text-xl font-bold tabular-nums ${color || 'text-slate'}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
