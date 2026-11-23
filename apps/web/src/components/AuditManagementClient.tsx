'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RESIDENT_ASSIGNMENT } from '@silvercare/contracts/src/generated/voice'
import { SHIFT_POLICY } from '@silvercare/contracts/src/generated/facility'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Card } from '@/components/ui/card'
import { TableCard, TableStateRow } from '@/components/patterns/TableCard'
import { Button } from '@/components/ui/button'
import { Download, Calendar, Filter, RotateCcw, Clock, ShieldCheck } from 'lucide-react'
import {
  AuditLogEntry,
  formatAuditTimestamp,
  formatAuditToCsv,
  formatAuditToJson
} from '@/lib/audit-helpers'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { StatusBadge } from '@/components/patterns/StatusBadge'

const [timeCorrected, segmentSplit] = RESIDENT_ASSIGNMENT.sourceReview.auditActions
const voiceDecisionLabels: Record<string, string> = { [timeCorrected]: 'Korekta czasu nagrania', [segmentSplit]: 'Podział fragmentu nagrania' }

interface AuditManagementClientProps {
  initialLogs: AuditLogEntry[]
  initialStartDate?: string
  initialEndDate?: string
  initialScope: 'all' | 'shift'
  page: number
  hasNext: boolean
  filterError?: string
}

export function AuditManagementClient({
  initialLogs,
  initialStartDate = '',
  initialEndDate = '',
  initialScope, page, hasNext, filterError,
}: AuditManagementClientProps) {
  const router = useRouter()
  const [startDate, setStartDate] = useState<string>(initialStartDate)
  const [endDate, setEndDate] = useState<string>(initialEndDate)
  const [scope, setScope] = useState(initialScope)

  // Wykrycie strefy czasowej przeglądarki
  const browserTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || SHIFT_POLICY.timezone
    } catch {
      return SHIFT_POLICY.timezone
    }
  }, [])

  const auditHref = (from: string, to: string, eventScope: string, pageNumber = 1) => {
    const params = new URLSearchParams()
    if (from) params.set('startDate', from)
    if (to) params.set('endDate', to)
    if (eventScope === 'shift') params.set('scope', eventScope)
    if (pageNumber > 1) params.set('page', String(pageNumber))
    return params.size ? `/admin/audit?${params}` : '/admin/audit'
  }

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(auditHref(startDate, endDate, scope))
  }

  const handleClearFilter = () => {
    setStartDate('')
    setEndDate('')
    setScope('all')
    router.push('/admin/audit')
  }

  const handleExportCsv = () => {
    const csvContent = formatAuditToCsv(initialLogs, browserTimeZone)
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
    const jsonContent = formatAuditToJson(initialLogs, browserTimeZone)
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
      <Card className="p-5">
        <form onSubmit={handleApplyFilter} className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <NativeSelect aria-label="Zakres zdarzeń" value={scope} onChange={(event) => setScope(event.target.value === 'shift' ? 'shift' : 'all')}>
              <NativeSelectOption value="all">Wszystkie zdarzenia</NativeSelectOption>
              <NativeSelectOption value="shift">Zmiany i nagrania</NativeSelectOption>
            </NativeSelect>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <label htmlFor="audit-date-from" className="text-sm font-medium text-foreground">Od</label>
              <input
                id="audit-date-from"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="min-h-touch rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="audit-date-to" className="text-sm font-medium text-foreground">Do</label>
              <input
                id="audit-date-to"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="min-h-touch rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <Button type="submit" size="sm" className="min-h-touch rounded-xl bg-primary text-white hover:bg-primary/90 gap-1.5 text-sm font-medium">
              <Filter className="h-3.5 w-3.5" />
              Filtruj
            </Button>

            {(initialStartDate || initialEndDate || startDate || endDate || scope === 'shift' || initialScope === 'shift' || filterError) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearFilter}
                className="min-h-touch rounded-xl border-border text-muted-foreground hover:bg-muted/50 gap-1.5 text-sm"
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
              disabled={!initialLogs.length}
              onClick={handleExportCsv}
              className="min-h-touch rounded-xl border-border text-foreground hover:bg-muted/50 gap-1.5 text-sm font-medium"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              Eksportuj CSV
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!initialLogs.length}
              onClick={handleExportJson}
              className="min-h-touch rounded-xl border-border text-foreground hover:bg-muted/50 gap-1.5 text-sm font-medium"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              Eksportuj JSON
            </Button>
          </div>
        </form>
        {filterError && <p role="alert" className="mt-2 text-sm text-destructive">{filterError}</p>}

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>Zakres dat w {SHIFT_POLICY.timezone}. Czas w tabeli: <strong className="text-foreground font-medium">{browserTimeZone}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Niezmienialny rejestr zdarzeń (RODO Append-Only) — bez danych wrażliwych podopiecznych</span>
          </div>
        </div>
      </Card>

      {/* Tabela zdarzeń audytowych */}
      <TableCard
        title="Zdarzenia audytowe"
        description={`Wyświetlono ${initialLogs.length} wpisów${initialStartDate || initialEndDate ? ' dla wybranego zakresu dat' : ''}.`}
      >
            <Table aria-label="Tabela rejestru audytowego">
              <TableHeader className="text-muted-foreground">
                <TableRow>
                  <TableHead scope="col">Czas</TableHead>
                  <TableHead scope="col">Akcja</TableHead>
                  <TableHead scope="col">Aktor</TableHead>
                  <TableHead scope="col">Szczegóły techniczne</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                      {formatAuditTimestamp(log.created_at, browserTimeZone)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge>{voiceDecisionLabels[log.action] ?? log.action}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      {log.performed_by && log.performed_by.toLowerCase() !== 'system' ? (
                        <BusinessIdBadge type="user" id={log.performed_by} />
                      ) : (
                        <span className="text-muted-foreground italic text-sm">System / Automat</span>
                      )}
                    </TableCell>
                    <TableCell className={voiceDecisionLabels[log.action] ? 'max-w-md whitespace-normal' : 'font-mono text-muted-foreground max-w-md truncate'}>
                      {voiceDecisionLabels[log.action] && log.payload ? <details>
                        <summary className="min-h-touch min-w-touch cursor-pointer">Metadane decyzji</summary>
                        <pre className="whitespace-pre-wrap break-all text-xs text-muted-foreground">{JSON.stringify(log.payload, null, 2)}</pre>
                      </details> : log.payload ? JSON.stringify(log.payload) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {initialLogs.length === 0 && (
                  <TableStateRow colSpan={4} state="empty" title="Brak wpisów" description="Rejestr nie zawiera zdarzeń dla wybranych kryteriów." />
                )}
              </TableBody>
            </Table>
      </TableCard>
      {(page > 1 || hasNext) && (
        <nav className="flex flex-wrap items-center gap-3 text-sm" aria-label="Strony rejestru audytowego">
          {page > 1 && <Link className="inline-flex min-h-touch items-center underline" href={auditHref(initialStartDate, initialEndDate, initialScope, page - 1)}>Poprzednia</Link>}
          {hasNext && <Link className="inline-flex min-h-touch items-center underline" href={auditHref(initialStartDate, initialEndDate, initialScope, page + 1)}>Następna</Link>}
          <span>Strona {page}. Eksport obejmuje wpisy z bieżącej strony.</span>
        </nav>
      )}
    </div>
  )
}
