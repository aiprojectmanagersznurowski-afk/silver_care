'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react'
import { MONTH_LABELS_PL } from '@/lib/reporting-constants'

interface DailyRow {
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

interface MonthlySummary {
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

export function DailyReportClient({ organizationId }: { organizationId?: string }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<DailyRow[]>([])
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)

    const supabase = createClient()

    const [{ data: dailyData }, { data: summaryData }] = await Promise.all([
      supabase.rpc('fn_daily_report', {
        p_org_id: organizationId,
        p_year: year,
        p_month: month,
      }),
      supabase.rpc('fn_monthly_summary', {
        p_org_id: organizationId,
        p_year: year,
        p_month: month,
      }),
    ])

    setData((dailyData as DailyRow[] | null) || [])
    const summaryArr = summaryData as MonthlySummary[] | null
    setSummary(Array.isArray(summaryArr) && summaryArr.length > 0 ? summaryArr[0] : null)
    setLoading(false)
  }, [organizationId, year, month])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const goToPrevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear(y => y - 1)
    } else {
      setMonth(m => m - 1)
    }
  }

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear(y => y + 1)
    } else {
      setMonth(m => m + 1)
    }
  }

  const exportCSV = () => {
    if (data.length === 0) return
    const headers = ['Data', 'Podopieczni', 'ZSN', 'Zgony', 'Podpisane umowy', 'Zakończone umowy', 'Delta', 'Dostępne miejsca', 'Zajęte']
    const rows = data.map(r => [
      r.report_date,
      r.total_residents,
      r.zsn_count,
      r.deaths,
      r.contracts_signed,
      r.contracts_ended,
      r.delta_change,
      r.available_beds,
      r.occupied_beds,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dane-dzienne-${year}-${String(month).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Month navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={goToPrevMonth} className="h-10 w-10 rounded-xl">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-xl font-semibold text-slate min-w-48 text-center">
            {MONTH_LABELS_PL[month - 1]} {year}
          </h3>
          <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-10 w-10 rounded-xl">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" onClick={exportCSV} className="rounded-xl gap-2" disabled={data.length === 0}>
          <Download className="h-4 w-4" />
          Eksport CSV
        </Button>
      </div>

      {/* Summary KPI cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <SummaryCard label="Średnia podopiecznych" value={summary.avg_residents?.toFixed(1)} />
          <SummaryCard label="Średnio ZSN" value={summary.avg_zsn ? summary.avg_zsn.toFixed(1) : '0'} />
          <SummaryCard label="Zgony" value={summary.total_deaths} variant="danger" />
          <SummaryCard label="Podpisane umowy" value={summary.total_contracts_signed} variant="success" />
          <SummaryCard label="Zakończone umowy" value={summary.total_contracts_ended} variant="warning" />
          <SummaryCard
            label="Zmiana netto"
            value={summary.net_change > 0 ? `+${summary.net_change}` : String(summary.net_change)}
            variant={summary.net_change >= 0 ? 'success' : 'danger'}
          />
        </div>
      )}

      {/* Daily data table */}
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-sage" />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-20 text-slate-soft">
              Brak danych dla wybranego miesiąca.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate/5">
                    <th className="sticky left-0 z-10 bg-slate/5 px-4 py-3 text-left font-semibold text-slate min-w-48 border-r border-slate/10">
                      MIESIĄC — {MONTH_LABELS_PL[month - 1].toUpperCase()} {year}
                    </th>
                    <th className="px-3 py-3 text-center font-semibold text-slate min-w-14 border-r border-slate/10">
                      ∑
                    </th>
                    {data.map((row) => {
                      const d = new Date(row.report_date)
                      const dayNum = d.getDate()
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6
                      return (
                        <th
                          key={row.report_date}
                          className={`px-2 py-3 text-center font-medium min-w-10 ${isWeekend ? 'bg-sage/5 text-sage' : 'text-slate-soft'}`}
                        >
                          {dayNum}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate/5">
                  {metricRows.map((metric) => {
                    const values = data.map((r) => getDailyValue(r, metric.key))
                    const summaryValue = metric.summaryKey && summary
                      ? getSummaryValue(summary, metric.summaryKey)
                      : metric.key === 'available_beds' && data.length > 0
                        ? data[0].available_beds
                        : null

                    const isHighlight = metric.key === 'total_residents' || metric.key === 'available_beds' || metric.key === 'occupied_beds'
                    const isDelta = metric.key === 'delta_change'

                    return (
                      <tr key={metric.key} className={`${isHighlight ? 'bg-sage/3 font-semibold' : ''} hover:bg-slate/5 transition-colors`}>
                        <td className={`sticky left-0 z-10 px-4 py-2.5 text-left whitespace-nowrap border-r border-slate/10 ${isHighlight ? 'bg-sage/3 text-slate font-semibold' : 'bg-white text-slate-soft font-medium'}`}>
                          {metric.label}
                        </td>
                        <td className={`px-3 py-2.5 text-center font-semibold border-r border-slate/10 ${isHighlight ? 'text-slate' : 'text-slate-soft'}`}>
                          {summaryValue != null
                            ? typeof summaryValue === 'number' && !Number.isInteger(summaryValue)
                              ? summaryValue.toFixed(1)
                              : summaryValue
                            : '—'}
                        </td>
                        {values.map((val, i) => (
                          <td
                            key={i}
                            className={`px-2 py-2.5 text-center tabular-nums ${
                              isDelta
                                ? val > 0
                                  ? 'text-emerald-600'
                                  : val < 0
                                    ? 'text-red-500'
                                    : 'text-slate-soft/50'
                                : metric.key === 'deaths' && val > 0
                                  ? 'text-red-500 font-medium'
                                  : val === 0
                                    ? 'text-slate-soft/30'
                                    : 'text-slate'
                            }`}
                          >
                            {isDelta && val > 0 ? `+${val}` : val}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: string | number | null | undefined
  variant?: 'default' | 'success' | 'danger' | 'warning'
}) {
  const colorMap = {
    default: 'bg-slate/5 text-slate',
    success: 'bg-emerald-50 text-emerald-700',
    danger: 'bg-red-50 text-red-600',
    warning: 'bg-amber-50 text-amber-700',
  }

  return (
    <div className={`rounded-xl p-4 ${colorMap[variant]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value ?? '—'}</p>
    </div>
  )
}
