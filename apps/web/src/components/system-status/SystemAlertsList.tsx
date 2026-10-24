'use client'

import React from 'react'
import { Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { type SystemAlertRecord } from '@/lib/system-status-helpers'

interface Props {
  alerts: SystemAlertRecord[]
  isPending: boolean
  onResolve: (alertId: string) => void
}

export function SystemAlertsList({ alerts, isPending, onResolve }: Props) {
  const activeAlerts = alerts.filter((a) => a.is_active)
  const resolvedAlerts = alerts.filter((a) => !a.is_active)

  return (
    <Card className="rounded-xl border-none ring-1 ring-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" /> Rejestr komunikatów
        </CardTitle>
        <CardDescription>Zarządzaj aktywnymi powiadomieniami i przeglądaj historię.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeAlerts.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-border text-center text-muted-foreground text-sm">
            Brak aktywnych alertów. Wszystkie placówki działają w trybie stabilnym.
          </div>
        ) : (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Aktywne komunikaty (widoczne w placówkach)</h4>
            {activeAlerts.map((a) => (
              <div
                key={a.id}
                data-testid="system-alert-item"
                data-alert-title={a.title}
                className="p-4 rounded-xl border border-border bg-muted/30 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{a.title}</span>
                      <StatusBadge>{a.severity}</StatusBadge>
                    </div>
                    <p className="text-sm text-foreground/80 mt-1">{a.message}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid="resolve-system-alert-btn"
                    disabled={isPending}
                    onClick={() => onResolve(a.id)}
                    className="shrink-0 min-h-11 text-sm font-semibold text-primary hover:text-primary"
                  >
                    Zakończ alert
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {resolvedAlerts.length > 0 && (
          <div className="pt-4 border-t border-border space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Ostatnio zakończone</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {resolvedAlerts.slice(0, 5).map((a) => (
                <div key={a.id} className="p-3 rounded-lg bg-muted/20 text-sm flex items-center justify-between">
                  <span className="font-medium text-foreground truncate">{a.title}</span>
                  <span className="text-sm text-muted-foreground shrink-0">Zakończono</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
