'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface AuditManagementClientProps {
  initialLogs: AuditLogEntry[]
  initialStartDate?: string
  initialEndDate?: string
}

export function AuditManagementClient({
  initialLogs,
  initialStartDate = '',
  initialEndDate = '',
}: AuditManagementClientProps) {
  const router = useRouter()
  const [startDate, setStartDate] = useState<string>(initialStartDate)
  const [endDate, setEndDate] = useState<string>(initialEndDate)
  const [appliedStartDate, setAppliedStartDate] = useState<string>(initialStartDate)
  const [appliedEndDate, setAppliedEndDate] = useState<string>(initialEndDate)

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
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    const q = params.toString()
    router.push(q ? `/admin/audit?${q}` : '/admin/audit')
  }

  const handleClearFilter = () => {
    setStartDate('')
    setEndDate('')
    setAppliedStartDate('')
    setAppliedEndDate('')
    router.push('/admin/audit')
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
      <Card className="rounded-xl border-none ring-1 ring-border bg-card p-5">
        <form onSubmit={handleApplyFilter} className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Od:</span>
              <input
                id="audit-date-from"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="h-9 rounded-xl border border-border bg-card px-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">Do:</span>
              <input
                id="audit-date-to"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="h-9 rounded-xl border border-border bg-card px-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <Button type="submit" size="sm" className="h-9 rounded-xl bg-primary text-white hover:bg-primary/90 gap-1.5 text-xs font-medium">
              <Filter className="h-3.5 w-3.5" />
              Filtruj
            </Button>

            {(appliedStartDate || appliedEndDate || startDate || endDate) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearFilter}
                className="h-9 rounded-xl border-border text-muted-foreground hover:bg-muted/50 gap-1.5 text-xs"
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
              className="h-9 rounded-xl border-border text-foreground hover:bg-muted/50 gap-1.5 text-xs font-medium"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              Eksportuj CSV
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportJson}
              className="h-9 rounded-xl border-border text-foreground hover:bg-muted/50 gap-1.5 text-xs font-medium"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              Eksportuj JSON
            </Button>
          </div>
        </form>

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>Strefa czasowa przeglądarki: <strong className="text-foreground font-medium">{browserTimeZone}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Niezmienialny rejestr zdarzeń (RODO Append-Only) — bez danych wrażliwych pensjonariuszy</span>
          </div>
        </div>
      </Card>

      {/* Tabela zdarzeń audytowych */}
      <Card className="rounded-xl border-none ring-1 ring-border overflow-hidden">
        <CardHeader className="border-b border-border bg-card px-6 py-5">
          <CardTitle className="text-lg font-semibold text-foreground">Zdarzenia Audytowe</CardTitle>
          <CardDescription className="text-muted-foreground">
            Wyświetlono {filteredLogs.length} wpisów{appliedStartDate || appliedEndDate ? ' dla wybranego zakresu dat' : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto">
            <Table aria-label="Tabela rejestru audytowego">
              <TableHeader className="text-muted-foreground">
                <TableRow>
                  <TableHead scope="col">Czas</TableHead>
                  <TableHead scope="col">Akcja</TableHead>
                  <TableHead scope="col">User ID (Aktor)</TableHead>
                  <TableHead scope="col">Szczegóły techniczne</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                      {formatAuditTimestamp(log.created_at, browserTimeZone)}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-foreground">
                      {log.performed_by ? (
                        <span className="bg-muted/50 px-2 py-1 rounded font-semibold text-foreground">{log.performed_by}</span>
                      ) : (
                        <span className="text-muted-foreground italic">System / Automat</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground max-w-md truncate">
                      {log.payload ? JSON.stringify(log.payload) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Brak wpisów w rejestrze audytowym dla wybranych kryteriów.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
