'use client'

import React, { useState } from 'react'
import { PlusCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  SYSTEM_SERVICES,
  type SystemAlertSeverity,
  type SystemAlertStatus,
  type SystemServiceId,
  type SystemAlertInput,
} from '@/lib/system-status-helpers'

interface Props {
  isPending: boolean
  onSubmit: (input: SystemAlertInput) => void
}

export function PublishAlertForm({ isPending, onSubmit }: Props) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<SystemAlertSeverity>('warning')
  const [status, setStatus] = useState<SystemAlertStatus>('maintenance')
  const [selectedServices, setSelectedServices] = useState<SystemServiceId[]>([])
  const [expiresAt, setExpiresAt] = useState('')

  const toggleService = (sId: SystemServiceId) => {
    setSelectedServices((prev) =>
      prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      title,
      message,
      severity,
      status,
      affectedServices: selectedServices,
      // datetime-local jest w czasie lokalnym; do serwera idzie ISO z strefą
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    })
  }

  return (
    <Card className="rounded-xl border-none ring-1 ring-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-primary" /> Nowy komunikat serwisowy
        </CardTitle>
        <CardDescription>
          Opublikuj informację dla placówek o pracach technicznych lub niedostępności usług.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Tytuł komunikatu</label>
            <input
              type="text"
              data-testid="system-alert-title-input"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Prace serwisowe — potok głosowy"
              className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Poziom ważności</label>
              <select
                data-testid="system-alert-severity-select"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SystemAlertSeverity)}
                className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="info">Informacja (niski)</option>
                <option value="warning">Ostrzeżenie (średni)</option>
                <option value="error">Awaria (krytyczny)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Stan systemu</label>
              <select
                data-testid="system-alert-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as SystemAlertStatus)}
                className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="maintenance">Prace serwisowe</option>
                <option value="degraded">Ograniczona dostępność</option>
                <option value="operational">Operacyjny (informacyjny)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Dotknięte moduły / usługi</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SYSTEM_SERVICES.map((s) => (
                <label
                  key={s.id}
                  data-testid={`service-checkbox-${s.id}`}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-colors min-h-touch has-focus-visible:ring-2 has-focus-visible:ring-ring ${
                    selectedServices.includes(s.id)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedServices.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                    className="sr-only"
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Treść dla placówek</label>
            <textarea
              data-testid="system-alert-message-input"
              required
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Krótki opis sytuacji dla personelu i kierowników placówek..."
              className="w-full p-3 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
            />
          </div>

          <div>
            <label htmlFor="system-alert-expires-at" className="text-sm font-medium text-foreground block mb-1">Wygasa (opcjonalnie)</label>
            <input
              id="system-alert-expires-at"
              type="datetime-local"
              data-testid="system-alert-expires-at-input"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              aria-describedby="system-alert-expires-at-hint"
              className="w-full h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
            />
            <p id="system-alert-expires-at-hint" className="text-sm text-muted-foreground mt-1">
              Bez terminu alert trwa do ręcznego zakończenia.
            </p>
          </div>

          <Button
            type="submit"
            data-testid="system-alert-publish-btn"
            disabled={isPending}
            className="w-full min-h-touch font-semibold text-sm"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Opublikuj alert dla placówek
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
