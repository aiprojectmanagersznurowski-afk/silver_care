'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { FamilyMessageForm } from '@/components/FamilyMessageForm'
import { ResidentSwitcher } from '@/components/ResidentSwitcher'
import { OnboardingModal } from '@/components/OnboardingModal'

interface Resident {
  id: string
  first_name: string
  last_name: string
}

interface Report {
  id: string
  resident_id: string
  created_at: string
  content: {
    text?: string
    metrics?: {
      steps?: number
      sleep_hours?: number
    }
  }
}

interface FamilyDashboardClientProps {
  resident: Resident
  reports: Report[]
}

/**
 * Widok kliencki dashboardu rodziny.
 */
export function FamilyDashboardClient({ resident, reports }: FamilyDashboardClientProps) {
  if (!resident) return null

  const latestReport = reports[0] // We know it's ordered by created_at DESC from the server

  return (
    <div className="space-y-6">
      <OnboardingModal />

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {resident.first_name} {resident.last_name}
        </h2>
        <p className="text-text-secondary">Najnowsze informacje z placówki</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {latestReport ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Raport z dnia</CardTitle>
              <CardDescription>
                {format(new Date(latestReport.created_at), "d MMMM yyyy", { locale: pl })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose prose-sm dark:prose-invert">
                <p className="whitespace-pre-wrap">{latestReport.content.text || 'Brak treści raportu.'}</p>
              </div>
              {latestReport.content.metrics && (
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {latestReport.content.metrics.steps && (
                    <div className="rounded-lg bg-surface-sunken p-3">
                      <div className="text-xs font-medium text-text-tertiary">Kroki</div>
                      <div className="mt-1 text-lg font-semibold">{latestReport.content.metrics.steps}</div>
                    </div>
                  )}
                  {latestReport.content.metrics.sleep_hours && (
                    <div className="rounded-lg bg-surface-sunken p-3">
                      <div className="text-xs font-medium text-text-tertiary">Sen</div>
                      <div className="mt-1 text-lg font-semibold">{latestReport.content.metrics.sleep_hours}h</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-text-secondary">
              Brak opublikowanych raportów na ten moment.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kontakt z administracją</CardTitle>
            <CardDescription>
              Zostaw wiadomość dla personelu (zostanie dostarczona do panelu głównego).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FamilyMessageForm residentId={resident.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
