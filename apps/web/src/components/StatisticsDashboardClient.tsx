'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react'
import { CARE_LEVEL_LABELS, CARE_LEVEL_COLORS, type CareLevel } from '@/lib/reporting-constants'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart as RechartsPieChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { StatisticsKpiSection, type OccupancyKpi } from './statistics/StatisticsKpiSection'
import {
  useStatisticsData,
  type CareLevelStat,
  type DeathsByStay,
  type ContractSourceStat,
  type AdmissionByMonth,
  type ContractEndReasonStat,
} from './statistics/useStatisticsData'

export type { OccupancyKpi, CareLevelStat, DeathsByStay, ContractSourceStat, AdmissionByMonth, ContractEndReasonStat }

interface Props {
  careLevelData: CareLevelStat[]
  occupancyKpi: OccupancyKpi | null
  deathsByStay: DeathsByStay[]
  contractSources: ContractSourceStat[]
  admissionsByMonth: AdmissionByMonth[]
  contractEndReasons: ContractEndReasonStat[]
}

export function StatisticsDashboardClient({
  careLevelData,
  occupancyKpi,
  deathsByStay,
  contractSources,
  admissionsByMonth,
  contractEndReasons,
}: Props) {
  const {
    pieData,
    totalResidents,
    deathsBarData,
    sourcesBarData,
    endReasonsPie,
    admissionsData,
    admissionSeries,
  } = useStatisticsData({
    careLevelData,
    deathsByStay,
    contractSources,
    admissionsByMonth,
    contractEndReasons,
  })

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
      <StatisticsKpiSection occupancyKpi={occupancyKpi} />

      {/* Charts Row 1: Care Level + Contract End Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Care Level Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" /> Stan podopiecznych
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Brak danych</p>
            ) : (
              <>
                <ChartContainer config={careLevelConfig} className="mx-auto h-64 w-full">
                  <RechartsPieChart>
                    <defs>
                      <pattern id="pattern-unknown-hatched" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--chart-5)" strokeWidth="2.5" />
                      </pattern>
                    </defs>
                    <ChartTooltip content={<ChartTooltipContent nameKey="id" hideLabel />} />
                    <Pie data={pieData} dataKey="value" nameKey="id" innerRadius={55} paddingAngle={2} strokeWidth={1}>
                      {pieData.map((entry, index) => {
                        const isUnknown = entry.id === CARE_LEVEL_LABELS.unknown
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={isUnknown ? 'url(#pattern-unknown-hatched)' : entry.fill}
                            stroke={isUnknown ? 'var(--chart-5)' : 'var(--background)'}
                            strokeWidth={isUnknown ? 2 : 1}
                          />
                        )
                      })}
                    </Pie>
                  </RechartsPieChart>
                </ChartContainer>
                {/* Legend */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {pieData.map((d) => {
                    const isUnknown = d.id === CARE_LEVEL_LABELS.unknown
                    return (
                      <div key={d.id} className="flex items-center gap-2 text-sm">
                        <div
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: isUnknown ? 'transparent' : d.fill,
                            border: isUnknown ? '2px dashed var(--chart-5)' : undefined,
                          }}
                        />
                        <span className="text-muted-foreground">{d.label}</span>
                        <span className="ml-auto font-semibold text-foreground tabular-nums">{d.value}</span>
                      </div>
                    )
                  })}
                  <div className="col-span-2 border-t border-border pt-2 mt-1 flex items-center justify-between text-sm font-semibold">
                    <span className="text-foreground">Razem</span>
                    <span className="text-foreground tabular-nums">{totalResidents}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Contract End Reasons */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" /> Powody zakończenia umowy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {endReasonsPie.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Brak danych</p>
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Zgony a długość pobytu
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deathsBarData.every(d => d.count === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-12">Brak danych</p>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Źródło umowy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sourcesBarData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Brak danych</p>
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Przyjęcia wg miesiąca i stanu
          </CardTitle>
        </CardHeader>
        <CardContent>
          {admissionsData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Brak danych</p>
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
