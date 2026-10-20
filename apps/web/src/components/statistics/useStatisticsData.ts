import {
  CARE_LEVEL_LABELS, CARE_LEVEL_COLORS,
  CONTRACT_END_REASON_LABELS, CONTRACT_SOURCE_LABELS,
  MONTH_LABELS_SHORT_PL, STAY_RANGE_ORDER,
  type CareLevel, type ContractSource,
} from '@/lib/reporting-constants'

export interface CareLevelStat {
  care_level: string
  resident_count: number
}

export interface DeathsByStay {
  stay_range: string
  cnt: number
}

export interface ContractSourceStat {
  source: string
  cnt: number
}

export interface AdmissionByMonth {
  admission_month: number
  care_level: string
  cnt: number
}

export interface ContractEndReasonStat {
  end_reason: string
  event_month: number
  cnt: number
}

export interface StatisticsDataProps {
  careLevelData: CareLevelStat[]
  deathsByStay: DeathsByStay[]
  contractSources: ContractSourceStat[]
  admissionsByMonth: AdmissionByMonth[]
  contractEndReasons: ContractEndReasonStat[]
}

const SERIES_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function useStatisticsData({
  careLevelData,
  deathsByStay,
  contractSources,
  admissionsByMonth,
  contractEndReasons,
}: StatisticsDataProps) {
  const pieData = careLevelData.map((d) => ({
    id: CARE_LEVEL_LABELS[(d.care_level || 'unknown') as CareLevel | 'unknown'] || d.care_level,
    label: CARE_LEVEL_LABELS[(d.care_level || 'unknown') as CareLevel | 'unknown'] || d.care_level,
    value: d.resident_count,
    fill: CARE_LEVEL_COLORS[(d.care_level || 'unknown') as CareLevel | 'unknown'],
  }))

  const totalResidents = careLevelData.reduce((sum, d) => sum + d.resident_count, 0)

  const deathsBarData = STAY_RANGE_ORDER.map(range => {
    const found = deathsByStay.find(d => d.stay_range === range)
    return { range, count: found ? found.cnt : 0 }
  })

  const sourcesBarData = contractSources.map(d => ({
    source: CONTRACT_SOURCE_LABELS[d.source as ContractSource] || d.source,
    count: d.cnt,
  }))

  const endReasonsPie = Object.entries(
    contractEndReasons.reduce<Record<string, number>>((acc, d) => {
      const label = CONTRACT_END_REASON_LABELS[d.end_reason as keyof typeof CONTRACT_END_REASON_LABELS] || d.end_reason
      acc[label] = (acc[label] || 0) + d.cnt
      return acc
    }, {})
  ).map(([id, value], i) => ({ id, label: id, value, fill: SERIES_COLORS[i % SERIES_COLORS.length] }))

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
  }).filter(d => Object.keys(d).some(k => k !== 'month' && (d[k] as number) > 0))

  const admissionSeries = [...new Set(
    admissionsByMonth.map(d =>
      CARE_LEVEL_LABELS[(d.care_level || 'unknown') as CareLevel | 'unknown'] || d.care_level
    )
  )].map(label => ({ key: slug(label), label }))

  return {
    pieData,
    totalResidents,
    deathsBarData,
    sourcesBarData,
    endReasonsPie,
    admissionsData,
    admissionSeries,
  }
}
