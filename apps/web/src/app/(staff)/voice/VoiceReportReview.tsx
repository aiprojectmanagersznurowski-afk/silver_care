'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Sparkles, AlertTriangle, ArrowRight } from 'lucide-react'
import { MedicationAlertBanner } from '@/components/MedicationAlertBanner'

interface VoiceReportReviewProps {
  finalReport: string
  onResetNote: () => void
  medicationEvent?: 'taken' | 'refused' | 'missed' | 'none' | string | null
  requiresMedicationConfirmation?: boolean
}

export function VoiceReportReview({
  finalReport,
  onResetNote,
  medicationEvent,
  requiresMedicationConfirmation,
}: VoiceReportReviewProps) {
  const [medConfirmed, setMedConfirmed] = useState(false)
  const isMedAlert = medicationEvent === 'refused' || medicationEvent === 'missed' || requiresMedicationConfirmation === true

  return (
    <div className="w-full rounded-xl bg-muted p-6 ring-1 ring-inset ring-border space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <h4 className="text-base font-semibold text-foreground">Szkic raportu gotowy</h4>
      </div>

      <p className="text-sm text-foreground leading-relaxed bg-card/60 p-4 rounded-xl">{finalReport}</p>

      {isMedAlert && (
        <MedicationAlertBanner
          event={medicationEvent}
          requiresConfirmation={requiresMedicationConfirmation}
          confirmed={medConfirmed}
          onConfirmChange={setMedConfirmed}
        />
      )}

      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted ring-1 ring-inset ring-border">
        <AlertTriangle className="h-5 w-5 text-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-foreground font-medium leading-relaxed">
          Twarde dane medyczne (np. parametry, leki) zostały usunięte z powyższego tekstu i bezpiecznie zarchiwizowane. Szkic możesz zatwierdzić w zakładce Raporty.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Link
          href="/staff/reports"
          className="flex-1 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary transition-colors min-h-11"
        >
          Przejdź do weryfikacji raportów
          <ArrowRight className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={onResetNote}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-card px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 ring-1 ring-inset ring-border transition-colors min-h-11"
        >
          Nagraj nową notatkę
        </button>
      </div>
    </div>
  )
}
