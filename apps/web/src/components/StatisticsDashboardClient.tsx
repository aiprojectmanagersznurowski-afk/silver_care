'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users, Bed, Heart, Activity,
  BarChart3, PieChart as PieChartIcon, ShieldCheck
} from 'lucide-react'
import {
  CARE_LEVEL_LABELS, CARE_LEVEL_COLORS,
  CONTRACT_END_REASON_LABELS, CONTRACT_SOURCE_LABELS,
  MONTH_LABELS_SHORT_PL, STAY_RANGE_ORDER,
  type CareLevel, type ContractSource, type ContractEndReason,
} from '@/lib/reporting-constants'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart as RechartsPieChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

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

// Serie wykresów: tokeny chart-* z kontraktu (ADR-014). Kolejność nie niesie oceny.
const SERIES_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

/** Klucz serii bezpieczny dla zmiennej CSS (--color-<klucz>). */
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ── Component ───────────────────────────────────────────────────────────────

export function StatisticsDashboardClient({
  careLevelData,
  occupancyKpi,
  deathsByStay,
  contractSources,
  admissionsByMonth,
  contractEndReasons,
}: Props) {
  const pieData = careLevelData.map((d) => ({
    id: CARE_LEVEL_LABELS[(d.care_level || 'unknown') as CareLevel | 'unknown'] || d.care_level,
    label: CARE_LEVEL_LABELS[(d.care_level || 'unknown') as CareLevel | 'unknown'] || d.care_level,
    value: d.resident_count,
    fill: CARE_LEVEL_COLORS[(d.care_level || 'unknown') as CareLevel | 'unknown'],
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
  ).map(([id, value], i) => ({ id, label: id, value, fill: SERIES_COLORS[i % SERIES_COLORS.length] }))

  // Admissions by month — stacked bar
  const admissionsData = Array.from({ length: 12 }, (_, i) => {
    const monthData: Record<string, string | number> = {
      month: MONTH_LABELS_SHORT_PL[i],
    }
    const monthEntries = admissionsByMonth.filter(d => d.admission_month === i + 1)
    for (const entry of monthEntries) {
      const label = CARE_LEVEL_LABELS[(entry.care_level || 'unknown') as CareLevel | 'unknown'] || entry.care_level
      monthData[slug(label)] = entry.cnt
    }
    return monthData
  }).filter(d => {
    // Only show months with data
    return Object.keys(d).some(k => k !== 'month' && (d[k] as number) > 0)
  })

  // Klucz serii to slug (bezpieczny dla zmiennej CSS), etykieta zostaje w konfiguracji wykresu
  const admissionSeries = [...new Set(
    admissionsByMonth.map(d =>
      CARE_LEVEL_LABELS[(d.care_level || 'unknown') as CareLevel | 'unknown'] || d.care_level
    )
  )].map(label => ({ key: slug(label), label }))

  const careLevelConfig: ChartConfig = Object.fromEntries(
    pieData.map((d) => [d.id, { label: d.label, color: d.fill }]),
  )
  const endReasonsConfig: ChartConfig = Object.fromEntries(
    endReasonsPie.map((d) => [d.id, { label: d.label, color: d.fill }]),
  )
  const countConfig: ChartConfig = { count: { label: 'Liczba', color: 'var(--chart-1)' } }
  const admissionsConfig: ChartConfig = Object.fromEntries(
    admissionSeries.map(({ key, label }) => {
      const entry = Object.entries(CARE_LEVEL_LABELS).find(([, v]) => v === label)
      const color = entry ? CARE_LEVEL_COLORS[entry[0] as CareLevel | 'unknown'] : 'var(--chart-5)'
      return [key, { label, color }]
    }),
  )

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
      )}

      {/* Charts Row 1: Care Level + Contract End Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Care Level Breakdown */}
        <Card className="rounded-xl border-none ring-1 ring-slate/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate">
              <PieChartIcon className="h-5 w-5 text-sage" /> Stan podopiecznych
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-slate-soft text-center py-12">Brak danych</p>
            ) : (
              <>
                <ChartContainer config={careLevelConfig} className="mx-auto h-64 w-full">
                  <RechartsPieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="id" hideLabel />} />
                    <Pie data={pieData} dataKey="value" nameKey="id" innerRadius={55} paddingAngle={2} strokeWidth={1} />
                  </RechartsPieChart>
                </ChartContainer>
                {/* Legend */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {pieData.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 text-sm">
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: d.fill }}
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
        <Card className="rounded-xl border-none ring-1 ring-slate/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate">
              <PieChartIcon className="h-5 w-5 text-sage" /> Powody zakończenia umowy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {endReasonsPie.length === 0 ? (
              <p className="text-sm text-slate-soft text-center py-12">Brak danych</p>
            ) : (
              <ChartContainer config={endReasonsConfig} className="mx-auto h-72 w-full">
                <RechartsPieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="id" hideLabel />} />
                  <Pie data={endReasonsPie} dataKey="value" nameKey="id" innerRadius={50} paddingAngle={2} strokeWidth={1} />
                  <ChartLegend content={<ChartLegendContent nameKey="id" />} />
                </RechartsPieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Deaths by Stay + Contract Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deaths by stay length */}
        <Card className="rounded-xl border-none ring-1 ring-slate/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate">
              <BarChart3 className="h-5 w-5 text-sage" /> Zgony a długość pobytu
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deathsBarData.every(d => d.count === 0) ? (
              <p className="text-sm text-slate-soft text-center py-12">Brak danych</p>
            ) : (
              <ChartContainer config={countConfig} className="h-72 w-full">
                <BarChart data={deathsBarData} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="range" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Contract Sources */}
        <Card className="rounded-xl border-none ring-1 ring-slate/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate">
              <BarChart3 className="h-5 w-5 text-sage" /> Źródło umowy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sourcesBarData.length === 0 ? (
              <p className="text-sm text-slate-soft text-center py-12">Brak danych</p>
            ) : (
              <ChartContainer config={countConfig} className="h-72 w-full">
                <BarChart data={sourcesBarData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <CartesianGrid horizontal={false} />
                  <YAxis dataKey="source" type="category" tickLine={false} axisLine={false} width={120} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Admissions by Month */}
      <Card className="rounded-xl border-none ring-1 ring-slate/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-slate">
            <BarChart3 className="h-5 w-5 text-sage" /> Przyjęcia wg miesiąca i stanu
          </CardTitle>
        </CardHeader>
        <CardContent>
          {admissionsData.length === 0 ? (
            <p className="text-sm text-slate-soft text-center py-12">Brak danych</p>
          ) : (
            <ChartContainer config={admissionsConfig} className="h-80 w-full">
              <BarChart data={admissionsData} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {admissionSeries.map(({ key }) => (
                  <Bar key={key} dataKey={key} stackId="admissions" fill={`var(--color-${key})`} />
                ))}
              </BarChart>
            </ChartContainer>
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
    <Card className="rounded-xl border-none ring-1 ring-slate/5">
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
