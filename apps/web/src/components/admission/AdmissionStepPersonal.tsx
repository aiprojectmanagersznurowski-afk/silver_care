'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import type { CareLevelType } from './admission-types'

interface AdmissionStepPersonalProps {
  firstName: string
  setFirstName: (val: string) => void
  lastName: string
  setLastName: (val: string) => void
  idValue: string
  handleIdChange: (val: string) => void
  idError: string | null
  calculatedBirthDate: string | null
  calculatedGender: 'M' | 'F' | null
  careLevel: CareLevelType
  setCareLevel: (val: CareLevelType) => void
  isZsn: boolean
  setIsZsn: (val: boolean) => void
  notes: string
  setNotes: (val: string) => void
}

export function AdmissionStepPersonal({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  idValue,
  handleIdChange,
  idError,
  calculatedBirthDate,
  calculatedGender,
  careLevel,
  setCareLevel,
  isZsn,
  setIsZsn,
  notes,
  setNotes,
}: AdmissionStepPersonalProps) {
  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="wiz-first-name">Imię</Label>
          <Input
            id="wiz-first-name"
            placeholder="np. Anna"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wiz-last-name">Nazwisko</Label>
          <Input
            id="wiz-last-name"
            placeholder="np. Kowalska"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wiz-id-val">PESEL</Label>
        <Input
          id="wiz-id-val"
          placeholder="11 cyfr"
          maxLength={11}
          value={idValue}
          onChange={(e) => handleIdChange(e.target.value)}
        />
        {idError && <p data-testid="national-id-error" className="text-sm text-destructive">{idError}</p>}
        {calculatedBirthDate && calculatedGender && (
          <div className="flex items-center gap-3 mt-1 text-sm text-foreground bg-muted p-2 rounded border border-border">
            <span>Data ur.: <strong>{calculatedBirthDate}</strong></span>
            <span>Płeć: <strong>{calculatedGender === 'F' ? 'Kobieta' : 'Mężczyzna'}</strong></span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="wiz-care-level">Poziom sprawności</Label>
          <NativeSelect
            id="wiz-care-level"
            className="w-full"
            value={careLevel}
            onChange={(e) => setCareLevel(e.target.value as CareLevelType)}
          >
            <NativeSelectOption value="walking">Chodzący (parter lub wyższe piętra)</NativeSelectOption>
            <NativeSelectOption value="sitting">Siedzący / wózek (rekomendowany parter)</NativeSelectOption>
            <NativeSelectOption value="bedridden">Leżący (rekomendowany parter)</NativeSelectOption>
            <NativeSelectOption value="hospice">Opieka paliatywna</NativeSelectOption>
          </NativeSelect>
        </div>

        <div className="flex items-center gap-2 pt-6">
          <input
            type="checkbox"
            id="wiz-zsn"
            checked={isZsn}
            onChange={(e) => setIsZsn(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary"
          />
          <Label htmlFor="wiz-zsn" className="text-sm font-normal cursor-pointer">
            ZSN: Znaczny stopień niepełnosprawności
          </Label>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wiz-notes">Uwagi przyjęciowe</Label>
        <Textarea
          id="wiz-notes"
          rows={2}
          className="w-full"
          placeholder="Dodatkowe informacje dla personelu..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </div>
  )
}
