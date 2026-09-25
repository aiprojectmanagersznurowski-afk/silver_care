'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Calendar, Filter, RotateCcw, Clock, ShieldCheck } from 'lucide-react'
import {
  AuditLogEntry,
  formatAuditTimestamp,
  formatAuditToCsv,
  formatAuditToJson,
  filterAuditLogsByDate
} from '@/lib/audit-helpers'

interface AuditManagementClientProps {
  initialLogs: AuditLogEntry[]
}

export function AuditManagementClient({ initialLogs }: AuditManagementClientProps) {
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [appliedStartDate, setAppliedStartDate] = useState<string>('')
  const [appliedEndDate, setAppliedEndDate] = useState<string>('')

  // Wykrycie strefy czasowej przeglądarki
  const browserTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw'
    } catch {
      return 'Europe/Warsaw'
    }
  }, [])

  const filteredLogs = useMemo(() => {
    return filterAuditLogsByDate(initialLogs, appliedStartDate, appliedEndDate)
  }, [initialLogs, appliedStartDate, appliedEndDate])

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedStartDate(startDate)
    setAppliedEndDate(endDate)
  }

  const handleClearFilter = () => {
    setStartDate('')
    setEndDate('')
    setAppliedStartDate('')
    setAppliedEndDate('')
  }

  const handleExportCsv = () => {
    const csvContent = formatAuditToCsv(filteredLogs, browserTimeZone)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `audit-rodo-export-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExportJson = () => {
    const jsonContent = formatAuditToJson(filteredLogs, browserTimeZone)
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `audit-rodo-export-${new Date().toISOString().slice(0, 10)}.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Pasek filtrów daty oraz akcji eksportu RODO */}
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5 bg-white p-5">
        <form onSubmit={handleApplyFilter} className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-soft" />
              <span className="text-xs font-medium text-slate">Od:</span>
              <input
                id="audit-date-from"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="h-9 rounded-xl border border-slate/20 bg-white px-3 text-xs text-slate focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate">Do:</span>
              <input
                id="audit-date-to"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="h-9 rounded-xl border border-slate/20 bg-white px-3 text-xs text-slate focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage"
              />
            </div>

            <Button type="submit" size="sm" className="h-9 rounded-xl bg-sage text-white hover:bg-sage/90 gap-1.5 text-xs font-medium">
              <Filter className="h-3.5 w-3.5" />
              Filtruj
            </Button>

            {(appliedStartDate || appliedEndDate || startDate || endDate) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearFilter}
                className="h-9 rounded-xl border-slate/20 text-slate-soft hover:bg-slate/5 gap-1.5 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Wyczyść
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-9 rounded-xl border-slate/20 text-slate hover:bg-slate/5 gap-1.5 text-xs font-medium"
            >
              <Download className="h-3.5 w-3.5 text-slate-soft" />
              Eksportuj CSV
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportJson}
              className="h-9 rounded-xl border-slate/20 text-slate hover:bg-slate/5 gap-1.5 text-xs font-medium"
            >
              <Download className="h-3.5 w-3.5 text-slate-soft" />
              Eksportuj JSON
            </Button>
          </div>
        </form>

        <div className="mt-3 pt-3 border-t border-slate/5 flex items-center justify-between text-xs text-slate-soft">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-sage" />
            <span>Strefa czasowa przeglądarki: <strong className="text-slate font-medium">{browserTimeZone}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-sage" />
            <span>Niezmienialny rejestr zdarzeń (RODO Append-Only) — bez danych wrażliwych pensjonariuszy</span>
          </div>
        </div>
      </Card>

      {/* Tabela zdarzeń audytowych */}
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5 overflow-hidden">
        <CardHeader className="border-b border-slate/5 bg-white px-6 py-5">
          <CardTitle className="text-lg font-semibold text-slate">Zdarzenia Audytowe</CardTitle>
          <CardDescription className="text-slate-soft">
            Wyświetlono {filteredLogs.length} wpisów{appliedStartDate || appliedEndDate ? ' dla wybranego zakresu dat' : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto">
            <table className="w-full text-left text-sm" aria-label="Tabela rejestru audytowego">
              <thead className="bg-slate/5 text-slate-soft">
                <tr>
                  <th scope="col" className="px-6 py-4 font-medium">Czas</th>
                  <th scope="col" className="px-6 py-4 font-medium">Akcja</th>
                  <th scope="col" className="px-6 py-4 font-medium">User ID (Aktor)</th>
                  <th scope="col" className="px-6 py-4 font-medium">Szczegóły techniczne</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/5 bg-white">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="transition-colors hover:bg-slate/5">
                    <td className="px-6 py-4 text-xs font-mono text-slate-soft whitespace-nowrap">
                      {formatAuditTimestamp(log.created_at, browserTimeZone)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-lg bg-slate/10 px-2.5 py-1 text-xs font-medium text-slate">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate">
                      {log.performed_by ? (
                        <span className="bg-slate/5 px-2 py-1 rounded font-semibold text-slate">{log.performed_by}</span>
                      ) : (
                        <span className="text-slate-soft italic">System / Automat</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-soft max-w-md truncate">
                      {log.payload ? JSON.stringify(log.payload) : '—'}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-soft">
                      Brak wpisów w rejestrze audytowym dla wybranych kryteriów.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
