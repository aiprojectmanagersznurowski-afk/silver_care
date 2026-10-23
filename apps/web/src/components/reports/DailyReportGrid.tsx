'use client'

import { ObjectCard, ObjectGrid } from '@/components/patterns/ObjectCard'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { ListEmpty, ListError, ListLoading } from '@/components/patterns/ListState'
import { metricRows, getDailyValue, type DailyRow } from './DailyReportTable'

interface DailyReportGridProps {
  data: DailyRow[]
  loading: boolean
  failed: boolean
}

/** Dane dzienne w widoku kafelkowym: jeden kafelek = jeden dzień, te same wskaźniki co wiersze tabeli. */
export function DailyReportGrid({ data, loading, failed }: DailyReportGridProps) {
  if (loading) return <ListLoading label="Wczytywanie danych dziennych" rows={5} />
  if (failed) return <ListError description="Dane dzienne są chwilowo niedostępne. Spróbuj ponownie za chwilę." />
  if (data.length === 0) {
    return <ListEmpty title="Brak danych dla wybranego miesiąca" description="Wybierz inny miesiąc strzałkami powyżej." />
  }

  return (
    <ObjectGrid>
      {data.map((row) => {
        const d = new Date(row.report_date)
        const isWeekend = d.getDay() === 0 || d.getDay() === 6
        return (
          <ObjectCard
            key={row.report_date}
            title={d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
            badges={isWeekend ? <StatusBadge>Weekend</StatusBadge> : undefined}
            meta={metricRows.map((metric) => {
              const val = getDailyValue(row, metric.key)
              return { label: metric.label, value: metric.key === 'delta_change' && val > 0 ? `+${val}` : String(val) }
            })}
          />
        )
      })}
    </ObjectGrid>
  )
}
