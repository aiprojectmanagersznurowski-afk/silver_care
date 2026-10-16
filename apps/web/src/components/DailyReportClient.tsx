'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { MONTH_LABELS_PL } from '@/lib/reporting-constants'
import { DailyReportTable, type DailyRow, type MonthlySummary } from '@/components/reports/DailyReportTable'

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
    void Promise.resolve().then(() => fetchData())
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
        <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 w-full sm:w-auto">
          <Button variant="outline" size="icon" onClick={goToPrevMonth} className="h-10 w-10 rounded-xl shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg sm:text-xl font-semibold text-foreground min-w-36 sm:min-w-48 text-center flex-1 sm:flex-initial">
            {MONTH_LABELS_PL[month - 1]} {year}
          </h3>
          <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-10 w-10 rounded-xl shrink-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" onClick={exportCSV} className="rounded-xl gap-2 w-full sm:w-auto" disabled={data.length === 0}>
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
      <DailyReportTable
        data={data}
        summary={summary}
        loading={loading}
        month={month}
        year={year}
      />
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
    default: 'bg-muted/50 text-foreground',
    success: 'bg-muted text-foreground',
    danger: 'bg-muted text-foreground',
    warning: 'bg-muted text-foreground',
  }

  return (
    <div className={`rounded-xl p-4 ${colorMap[variant]}`}>
      <p className="text-sm font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value ?? '—'}</p>
    </div>
  )
}
