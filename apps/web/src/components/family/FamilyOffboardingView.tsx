'use client'

import React from 'react'
import { Download, Clock, BookOpen, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/patterns/PageHeader'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { ListEmpty } from '@/components/patterns/ListState'
import { Button } from '@/components/ui/button'
import { formatPersonName } from '@/lib/person-name'
import {
  buildMemorialArchiveDocument,
  type FamilyOffboardingState,
  type MemorialReportEntry,
} from '@/lib/family-offboarding'

export interface FamilyOffboardingViewProps {
  resident: {
    id: string
    first_name: string
    last_name: string
    death_date?: string | null
    contract_end_date?: string | null
  }
  state: Exclude<FamilyOffboardingState, { mode: 'active' }>
  reports: MemorialReportEntry[]
}

export function FamilyOffboardingView({
  resident,
  state,
  reports,
}: FamilyOffboardingViewProps) {
  const fullName = formatPersonName(resident.first_name, resident.last_name)

  const handleDownloadArchive = () => {
    const doc = buildMemorialArchiveDocument({
      resident,
      reports,
    })
    const blob = new Blob([doc.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = doc.fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (state.mode === 'retention_expired') {
    return (
      <div className="mx-auto my-12 max-w-xl rounded-xl border border-border bg-card p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </div>
        <PageHeader
          title="Okres retencji dostępu wygasł"
          description={`30-dniowe okno dostępu do historii pobytu podopiecznego (${fullName}) dobiegło końca zgodnie z polityką ochrony danych placówki.`}
        />
        <form action="/auth/signout" method="post" className="pt-2">
          <Button type="submit" variant="outline" className="min-h-touch">
            Wyloguj się
          </Button>
        </form>
      </div>
    )
  }

  const isDeceased = state.reason === 'deceased'
  const archiveLabel = isDeceased ? 'pamiątkowe archiwum pobytu' : 'archiwum raportów z pobytu'
  const downloadButtonText = isDeceased ? 'Pobierz pamiątkowe archiwum pobytu' : 'Pobierz archiwum raportów z pobytu'

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        <PageHeader
          title={fullName}
          description={
            isDeceased
              ? 'Wyciszony widok pamiątkowy dla bliskich. Poniżej znajdują się zgromadzone wspomnienia i opublikowane raporty z okresu pobytu w placówce.'
              : 'Pobyt podopiecznego w placówce został zakończony. Poniżej udostępniamy archiwum raportów z okresu pobytu.'
          }
          actions={
            <StatusBadge>
              {isDeceased ? `Pamięci podopiecznego (${state.endDate})` : `Zakończony pobyt (${state.endDate})`}
            </StatusBadge>
          }
        />

        <section
          aria-label="Informacja o okresie retencji i archiwum"
          className="rounded-xl border border-border bg-card p-6 space-y-4"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <span>
                  Dostęp do portalu wygasa: <strong>{state.expiryDate}</strong> (pozostało dni: {state.daysRemaining})
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Przez 30 dni od daty zakończenia pobytu mogą Państwo przeglądać i pobrać {archiveLabel}. Po upływie tego terminu dostęp konta do danych podopiecznego wygasa.
              </p>
            </div>

            <Button
              type="button"
              onClick={handleDownloadArchive}
              data-testid="download-memorial-archive-btn"
              className="min-h-touch shrink-0"
            >
              <Download className="size-4 mr-2" aria-hidden="true" />
              {downloadButtonText}
            </Button>
          </div>
        </section>

        <section aria-label="Pamiątkowe raporty z pobytu" className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-semibold text-foreground">
              Archiwum opublikowanych raportów ({reports.length})
            </h2>
          </div>

          {reports.length === 0 ? (
            <ListEmpty
              title="Brak opublikowanych raportów w archiwum"
              description="W historii pobytu nie zapisano opublikowanych raportów dziennych."
            />
          ) : (
            <div className="space-y-3">
              {reports.map((report) => {
                const dateStr = report.created_at.slice(0, 10)
                const stepsVal = report.content?.metrics?.steps
                const sleepVal = report.content?.metrics?.sleep_hours
                return (
                  <article
                    key={report.id}
                    className="rounded-xl border border-border bg-card p-5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{dateStr}</span>
                      {(typeof stepsVal === 'number' || typeof sleepVal === 'number') && (
                        <span className="text-xs text-muted-foreground">
                          {typeof stepsVal === 'number' ? `Kroki: ${stepsVal}` : ''}
                          {typeof stepsVal === 'number' && typeof sleepVal === 'number' ? ' · ' : ''}
                          {typeof sleepVal === 'number' ? `Sen: ${sleepVal} godz.` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      {report.content?.text || 'Brak treści podsumowania z tego dnia.'}
                    </p>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
