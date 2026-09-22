'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Watch, RefreshCw, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react'

interface PolarWearableCardProps {
  residentId: string
  initialLinked: boolean
  externalUserId?: string | null
  linkedAt?: string | null
}

export function PolarWearableCard({
  residentId,
  initialLinked,
  externalUserId,
  linkedAt
}: PolarWearableCardProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncStatus(null)
    setIsError(false)

    try {
      const res = await fetch('/api/polar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residentId })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Błąd synchronizacji')
      }

      setIsError(false)
      if (data.metricsCount > 0) {
        setSyncStatus(`Zsynchronizowano ${data.metricsCount} pomiarów telemetrii (${data.result?.inserted || 0} nowych wpisów)`)
      } else {
        setSyncStatus(data.message || 'Brak nowych danych telemetrycznych z opaski')
      }
    } catch (err: unknown) {
      setIsError(true)
      const msg = err instanceof Error ? err.message : 'Wystąpił błąd podczas synchronizacji'
      setSyncStatus(msg)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Watch className="h-5 w-5 text-indigo-600" />
            <CardTitle className="text-lg font-display text-slate">Opaska telemetryczna Polar 360</CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-soft">
            Integracja przez Polar AccessLink API v3 (kroki, sen, czas aktywności)
          </CardDescription>
        </div>
        {initialLinked ? (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1.5 py-1 px-2.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Połączono
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50/50 flex items-center gap-1 py-1 px-2.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Niepołączono
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4 pt-2">
        {initialLinked ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-slate-50/60 p-3.5 rounded-xl border border-slate-100">
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Identyfikator użytkownika Polar</span>
                <span className="font-mono font-medium text-slate-800">{externalUserId || 'Brak'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Data sparowania</span>
                <span className="font-medium text-slate-800">
                  {linkedAt ? new Date(linkedAt).toLocaleDateString('pl-PL') : 'Aktywne'}
                </span>
              </div>
            </div>

            {syncStatus && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                isError ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {isError ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                <span>{syncStatus}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing}
                className="gap-2 text-xs font-medium"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Pobieranie danych...' : 'Synchronizuj teraz'}
              </Button>

              <a
                href={`/api/polar/auth?residentId=${residentId}`}
                className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 font-medium transition-colors"
              >
                Zmień powiązanie
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <p className="text-sm text-slate-600">
              Podopieczny nie ma jeszcze sparowanej opaski Polar. Połączenie pozwoli automatycznie zliczać kroki, czas aktywności i długość snu z zachowaniem ochrony danych osobowych.
            </p>
            <a
              href={`/api/polar/auth?residentId=${residentId}`}
              className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs font-medium rounded-xl h-9 px-4 transition-colors shadow-sm"
            >
              <Watch className="h-4 w-4" />
              Sparuj opaskę w Polar Flow
              <ExternalLink className="h-3.5 w-3.5 ml-1 opacity-70" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
