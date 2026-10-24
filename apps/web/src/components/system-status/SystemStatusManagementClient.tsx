'use client'

import React, { useState, useTransition } from 'react'
import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  type SystemAlertRecord,
  type SystemAlertInput,
} from '@/lib/system-status-helpers'
import { publishSystemAlertAction, resolveSystemAlertAction } from '@/actions/system-status'
import { PublishAlertForm } from './PublishAlertForm'
import { SystemAlertsList } from './SystemAlertsList'

interface Props {
  initialAlerts: SystemAlertRecord[]
}

export function SystemStatusManagementClient({ initialAlerts }: Props) {
  const [alerts, setAlerts] = useState<SystemAlertRecord[]>(initialAlerts)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const activeAlerts = alerts.filter((a) => a.is_active)
  const isSystemHealthy = activeAlerts.length === 0

  const handlePublish = (input: SystemAlertInput) => {
    setErrorMsg(null)
    setSuccessMsg(null)

    startTransition(async () => {
      const res = await publishSystemAlertAction(input)

      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setSuccessMsg('Opublikowano alert systemowy. Placówki widzą komunikat w nagłówku.')
        const newRecord: SystemAlertRecord = {
          id: res.alertId || crypto.randomUUID(),
          title: input.title,
          message: input.message,
          severity: input.severity,
          status: input.status,
          affected_services: input.affectedServices,
          is_active: true,
          created_at: new Date().toISOString(),
        }
        setAlerts((prev) => [newRecord, ...prev])
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('system-alert-updated'))
        }
      }
    })
  }

  const handleResolve = (alertId: string) => {
    setErrorMsg(null)
    setSuccessMsg(null)

    startTransition(async () => {
      const res = await resolveSystemAlertAction(alertId)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setSuccessMsg('Zakończono alert. Status systemu powrócił do stabilnego.')
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === alertId ? { ...a, is_active: false, status: 'operational', resolved_at: new Date().toISOString() } : a
          )
        )
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('system-alert-updated'))
        }
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* KPI Status Systemu */}
      <Card className="rounded-xl border-none ring-1 ring-border">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  isSystemHealthy ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground'
                }`}
              >
                {isSystemHealthy ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ogólny stan operacyjny platformy</p>
                <h3 data-testid="system-overall-status" className="text-2xl font-bold text-foreground">
                  {isSystemHealthy ? 'Stabilny — Wszystkie usługi działają' : `Aktywne alerty: ${activeAlerts.length}`}
                </h3>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                isSystemHealthy
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'bg-muted text-foreground border border-border'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              {isSystemHealthy ? 'Pełna dostępność' : 'Trwają prace serwisowe'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Komunikaty akcji */}
      {errorMsg && (
        <div role="alert" className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div role="status" className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <PublishAlertForm isPending={isPending} onSubmit={handlePublish} />
        <SystemAlertsList alerts={alerts} isPending={isPending} onResolve={handleResolve} />
      </div>
    </div>
  )
}
