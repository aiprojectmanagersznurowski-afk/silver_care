'use client'

import React from 'react'

interface AdmissionStepSummaryProps {
  firstName: string
  lastName: string
  idValue: string
  calculatedGender: 'M' | 'F' | null
  calculatedBirthDate: string | null
  careLevel: string
  isZsn: boolean
  selectedBedInfo: string | null
  notes: string
}

export function AdmissionStepSummary({
  firstName,
  lastName,
  idValue,
  calculatedGender,
  calculatedBirthDate,
  careLevel,
  isZsn,
  selectedBedInfo,
  notes,
}: AdmissionStepSummaryProps) {
  return (
    <div className="space-y-4 py-2 text-sm text-foreground">
      <div className="bg-muted p-4 rounded-lg border border-border space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-sm text-muted-foreground block">Imię i nazwisko</span>
            <span className="font-semibold">{firstName} {lastName}</span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground block">Identyfikator (PESEL)</span>
            <span className="font-mono">{idValue.slice(0, 6)}*****</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-sm text-muted-foreground block">Płeć i data ur.</span>
            <span>{calculatedGender === 'F' ? 'Kobieta' : 'Mężczyzna'}, {calculatedBirthDate}</span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground block">Profil opiekuńczy</span>
            <span>{careLevel} {isZsn ? '(ZSN: Znaczny stopień niepełnosprawności)' : ''}</span>
          </div>
        </div>

        <div>
          <span className="text-sm text-muted-foreground block">Przypisane łóżko</span>
          <span className="font-medium text-foreground">
            {selectedBedInfo || 'Brak przypisanego łóżka (można przypisać później)'}
          </span>
        </div>

        {notes && (
          <div>
            <span className="text-sm text-muted-foreground block">Uwagi</span>
            <span className="italic">{notes}</span>
          </div>
        )}
      </div>
    </div>
  )
}
