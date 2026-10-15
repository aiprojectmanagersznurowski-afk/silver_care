'use client'

import React from 'react'
import { AlertTriangle, BedDouble, ShieldCheck } from 'lucide-react'

interface DischargeConsequencesAlertProps {
  activeBedLabel?: string | null
}

export function DischargeConsequencesAlert({ activeBedLabel }: DischargeConsequencesAlertProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-2 text-sm text-foreground">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
        <span>Konsekwencje formalne i zasobowe</span>
      </div>
      <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-sm">
        {activeBedLabel ? (
          <li className="flex items-center gap-1.5">
            <BedDouble className="h-3.5 w-3.5 text-foreground shrink-0" />
            <span>
              Nastąpi natychmiastowe zwolnienie przypisanego miejsca:{' '}
              <strong className="text-foreground">{activeBedLabel}</strong>.
            </span>
          </li>
        ) : (
          <li>Podopieczny nie ma obecnie aktywnego przypisania do łóżka.</li>
        )}
        <li className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-foreground shrink-0" />
          <span>
            <strong>Portal Rodziny:</strong> Bliscy zachowują dostęp do wglądu w dotychczasową historię (tryb tylko do odczytu).
          </span>
        </li>
        <li>
          Zdarzenie zostanie odnotowane w rejestrze statystyk placówki (BI) oraz audycie.
        </li>
      </ul>
    </div>
  )
}
