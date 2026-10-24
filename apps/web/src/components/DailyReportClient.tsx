'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Download, Users, ShieldCheck, Heart, FileSignature, FileX, Activity } from 'lucide-react'
import { MONTH_LABELS_PL } from '@/lib/reporting-constants'
import { DailyReportTable, type DailyRow, type MonthlySummary } from '@/components/reports/DailyReportTable'
import { DailyReportGrid } from '@/components/reports/DailyReportGrid'
import { MetricCard, MetricGrid } from '@/components/patterns/MetricCard'
import { ViewToggle, GRID_TABLE_OPTIONS } from '@/components/patterns/ViewToggle'
import { useViewPreference, VIEW_PREFERENCE_KEYS } from '@/hooks/use-view-preference'

export function DailyReportClient({ organizationId }: { organizationId?: string }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<DailyRow[]>([])
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [viewMode, setViewMode] = useViewPreference(VIEW_PREFERENCE_KEYS.dailyReport, 'table', ['table', 'grid'] as const)

  const fetchData = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)

    const supabase = createClient()

    const [{ data: dailyData, error: dailyError }, { data: summaryData, error: summaryError }] = await Promise.all([
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

    setFailed(Boolean(dailyError || summaryError))
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
          <Button variant="outline" size="icon" onClick={goToPrevMonth} className="size-11 rounded-xl shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg sm:text-xl font-semibold text-foreground min-w-36 sm:min-w-48 text-center flex-1 sm:flex-initial">
            {MONTH_LABELS_PL[month - 1]} {year}
          </h3>
          <Button variant="outline" size="icon" onClick={goToNextMonth} className="size-11 rounded-xl shrink-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <ViewToggle value={viewMode} onChange={setViewMode} options={GRID_TABLE_OPTIONS} />
          <Button variant="outline" onClick={exportCSV} className="min-h-touch gap-2" disabled={data.length === 0}>
            <Download className="h-4 w-4" />
            Eksport CSV
          </Button>
        </div>
      </div>

      {/* Summary KPI cards */}
      {summary && (
        <MetricGrid>
          <MetricCard icon={<Users />} label="Średnia podopiecznych" value={summary.avg_residents?.toFixed(1) ?? '—'} />
          <MetricCard icon={<ShieldCheck />} label="Średnio ZSN" value={summary.avg_zsn ? summary.avg_zsn.toFixed(1) : '0'} />
          <MetricCard icon={<Heart />} label="Zgony" value={summary.total_deaths ?? '—'} />
          <MetricCard icon={<FileSignature />} label="Podpisane umowy" value={summary.total_contracts_signed ?? '—'} />
          <MetricCard icon={<FileX />} label="Zakończone umowy" value={summary.total_contracts_ended ?? '—'} />
          <MetricCard icon={<Activity />} label="Zmiana netto" value={summary.net_change > 0 ? `+${summary.net_change}` : String(summary.net_change)} />
        </MetricGrid>
      )}

      {/* Daily data table */}
      {viewMode === 'grid' ? (
        <DailyReportGrid data={data} loading={loading} failed={failed} />
      ) : (
      <DailyReportTable
        data={data}
        summary={summary}
        loading={loading}
        failed={failed}
        month={month}
        year={year}
      />
      )}
    </div>
  )
}
