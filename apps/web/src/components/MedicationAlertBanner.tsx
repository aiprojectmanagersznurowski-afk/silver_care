'use client'

import React from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

export interface MedicationAlertBannerProps {
  event?: 'taken' | 'refused' | 'missed' | 'none' | string | null
  requiresConfirmation?: boolean
  confirmed?: boolean
  onConfirmChange?: (confirmed: boolean) => void
  interactive?: boolean
}

export function MedicationAlertBanner({
  event,
  requiresConfirmation,
  confirmed = false,
  onConfirmChange,
  interactive = true,
}: MedicationAlertBannerProps) {
  const isRefused = event === 'refused'
  const isMissed = event === 'missed'
  const isAlert = isRefused || isMissed || requiresConfirmation === true

  if (!isAlert) return null

  const title = isRefused
    ? 'Odnotowano odmowę przyjęcia zaplanowanego wsparcia (leków)'
    : isMissed
    ? 'Odnotowano pominięcie zaplanowanego wsparcia (leków)'
    : 'Wymagane potwierdzenie zdarzenia lekowego'

  const description = isRefused
    ? 'Podopieczny odmówił przyjęcia wsparcia w oknie czasowym. Upewnij się, że fakt został odnotowany w dokumentacji personelu.'
    : 'Zaplanowana dawka wsparcia została pominięta. Wymagane potwierdzenie procedury i obserwacja podopiecznego.'

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="medication-alert-banner"
      className="w-full rounded-xl border border-border bg-muted p-4 space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-card border border-border shrink-0 mt-0.5">
          <AlertTriangle className="h-5 w-5 text-foreground" />
        </div>
        <div className="space-y-1">
          <h5 className="text-sm font-semibold text-foreground leading-snug">{title}</h5>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>

      {interactive && onConfirmChange && (
        <label className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border cursor-pointer hover:bg-muted/50 transition-colors min-h-11">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => onConfirmChange(e.target.checked)}
            className="h-5 w-5 rounded border-border text-primary focus:ring-primary shrink-0"
            data-testid="medication-confirm-checkbox"
          />
          <span className="text-sm font-medium text-foreground select-none">
            Potwierdzam odnotowanie zdarzenia w dokumentacji dyżuru personelu
          </span>
        </label>
      )}

      {confirmed && (
        <div className="flex items-center gap-2 text-sm font-medium text-foreground pl-1">
          <CheckCircle2 className="h-4 w-4 text-foreground" />
          <span>Zdarzenie potwierdzone przez personel</span>
        </div>
      )}
    </div>
  )
}
