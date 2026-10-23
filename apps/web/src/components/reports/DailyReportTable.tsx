import { TableCard } from '@/components/patterns/TableCard'
import { ListEmpty, ListError, ListLoading } from '@/components/patterns/ListState'
import { MONTH_LABELS_PL } from '@/lib/reporting-constants'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export interface DailyRow {
  report_date: string
  total_residents: number
  zsn_count: number
  deaths: number
  contracts_signed: number
  contracts_ended: number
  delta_change: number
  available_beds: number
  occupied_beds: number
}

export interface MonthlySummary {
  avg_residents: number
  avg_zsn: number
  total_deaths: number
  total_contracts_signed: number
  total_contracts_ended: number
  net_change: number
  total_revenue: number
}

type DailyRowKey = keyof DailyRow
type SummaryKey = keyof MonthlySummary

interface MetricRow {
  key: DailyRowKey
  label: string
  summaryKey: SummaryKey | null
}

const metricRows: MetricRow[] = [
  { key: 'total_residents', label: 'ILOŚĆ PODOPIECZNYCH OGÓŁEM', summaryKey: 'avg_residents' },
  { key: 'zsn_count', label: 'ZSN: Znaczny stopień niepełnosprawności', summaryKey: 'avg_zsn' },
  { key: 'deaths', label: 'Zgony', summaryKey: 'total_deaths' },
  { key: 'contracts_signed', label: 'Podpisane umowy', summaryKey: 'total_contracts_signed' },
  { key: 'contracts_ended', label: 'Zakończone umowy', summaryKey: 'total_contracts_ended' },
  { key: 'delta_change', label: 'Delta Zmiany', summaryKey: 'net_change' },
  { key: 'available_beds', label: 'DOSTĘPNE MIEJSCA', summaryKey: null },
  { key: 'occupied_beds', label: 'OGÓŁEM DZIEŃ', summaryKey: null },
]

function getDailyValue(row: DailyRow, key: DailyRowKey): number {
  const val = row[key]
  return typeof val === 'number' ? val : 0
}

function getSummaryValue(summary: MonthlySummary, key: SummaryKey): number {
  return summary[key]
}

export function DailyReportTable({
  data,
  summary,
  loading,
  failed = false,
  month,
  year,
}: {
  data: DailyRow[]
  summary: MonthlySummary | null
  loading: boolean
  failed?: boolean
  month: number
  year: number
}) {
  return (
    <TableCard>
        {loading ? (
          <ListLoading label="Wczytywanie danych dziennych" rows={5} />
        ) : failed ? (
          <div className="p-4">
            <ListError description="Dane dzienne są chwilowo niedostępne. Spróbuj ponownie za chwilę." />
          </div>
        ) : data.length === 0 ? (
          <ListEmpty framed={false} title="Brak danych dla wybranego miesiąca" description="Wybierz inny miesiąc strzałkami powyżej." />
        ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 min-w-48 border-r">
                    MIESIĄC — {MONTH_LABELS_PL[month - 1].toUpperCase()} {year}
                  </TableHead>
                  <TableHead className="text-center min-w-14 border-r">
                    ∑
                  </TableHead>
                  {data.map((row) => {
                    const d = new Date(row.report_date)
                    const dayNum = d.getDate()
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6
                    return (
                      <TableHead
                        key={row.report_date}
                        className={`px-2 py-3 text-center font-medium min-w-touch ${
                          isWeekend ? 'bg-primary/5 text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {dayNum}
                      </TableHead>
                    )
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {metricRows.map((metric) => {
                  const values = data.map((r) => getDailyValue(r, metric.key))
                  const summaryValue = metric.summaryKey && summary
                    ? getSummaryValue(summary, metric.summaryKey)
                    : metric.key === 'available_beds' && data.length > 0
                      ? data[0].available_beds
                      : null

                  const isHighlight =
                    metric.key === 'total_residents' ||
                    metric.key === 'available_beds' ||
                    metric.key === 'occupied_beds'
                  const isDelta = metric.key === 'delta_change'

                  return (
                    <TableRow
                      key={metric.key}
                      className={`${isHighlight ? 'bg-primary/3 font-semibold' : ''} hover:bg-muted/50 transition-colors`}
                    >
                      <TableCell
                        className={`sticky left-0 z-10 px-4 py-2.5 text-left whitespace-nowrap border-r border-border ${
                          isHighlight
                            ? 'bg-primary/3 text-foreground font-semibold'
                            : 'bg-card text-muted-foreground font-medium'
                        }`}
                      >
                        {metric.label}
                      </TableCell>
                      <TableCell
                        className={`px-3 py-2.5 text-center font-semibold border-r border-border ${
                          isHighlight ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {summaryValue != null
                          ? typeof summaryValue === 'number' && !Number.isInteger(summaryValue)
                            ? summaryValue.toFixed(1)
                            : summaryValue
                          : '—'}
                      </TableCell>
                      {values.map((val, i) => (
                        <TableCell
                          key={i}
                          className={`px-2 py-2.5 text-center tabular-nums ${
                            isDelta
                              ? val > 0
                                ? 'text-foreground'
                                : val < 0
                                  ? 'text-foreground'
                                  : 'text-muted-foreground/50'
                              : metric.key === 'deaths' && val > 0
                                ? 'text-foreground font-medium'
                                : val === 0
                                  ? 'text-muted-foreground/30'
                                  : 'text-foreground'
                          }`}
                        >
                          {isDelta && val > 0 ? `+${val}` : val}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
        )}
    </TableCard>
  )
}
