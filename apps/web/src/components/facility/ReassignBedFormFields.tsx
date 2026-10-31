'use client'

import React from 'react'
import { Label } from '@/components/ui/label'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { formatSectorName } from '@/lib/sector'

export interface AvailableBedOption {
  bedId: string
  bedLabel: string
  roomId: string
  roomNumber: string
  floor: string
  sector?: string | null
  existingGenders: Array<'M' | 'F'>
}

interface ReassignBedFormFieldsProps {
  residentName: string
  currentRoomNumber: string
  currentBedLabel: string
  currentFloor?: string
  residentGender?: 'M' | 'F'
  residentIsZsn?: boolean
  selectedBedId: string
  setSelectedBedId: (id: string) => void
  isLoadingBeds: boolean
  availableBeds: AvailableBedOption[]
  genderWarning: string | null
  mobilityWarning: string | null
  selectedOption?: AvailableBedOption
  reason: string
  setReason: (r: string) => void
  customReason: string
  setCustomReason: (cr: string) => void
}

export function ReassignBedFormFields({
  residentName,
  currentRoomNumber,
  currentBedLabel,
  currentFloor,
  residentGender,
  residentIsZsn,
  selectedBedId,
  setSelectedBedId,
  isLoadingBeds,
  availableBeds,
  genderWarning,
  mobilityWarning,
  selectedOption,
  reason,
  setReason,
  customReason,
  setCustomReason,
}: ReassignBedFormFieldsProps) {
  return (
    <div className="space-y-4 py-4">
      {/* Aktualne przypisanie */}
      <div className="rounded-lg bg-muted/40 p-3 text-sm border space-y-1">
        <div className="font-medium text-foreground">{residentName}</div>
        <div className="text-muted-foreground text-sm">
          Obecne miejsce: <strong>Pokój {currentRoomNumber}</strong>, Łóżko {currentBedLabel}
          {currentFloor ? ` (${currentFloor})` : ''}
        </div>
        {residentGender && (
          <div className="text-sm text-muted-foreground">
            Płeć: <strong>{residentGender === 'M' ? 'Mężczyzna' : 'Kobieta'}</strong>
            {residentIsZsn ? ' • ZSN (Zwiększone zapotrzebowanie na opiekę)' : ''}
          </div>
        )}
      </div>

      {/* Wybór docelowego łóżka */}
      <div className="space-y-2">
        <Label htmlFor="target-bed">Docelowe wolne łóżko</Label>
        {isLoadingBeds ? (
          <div className="text-sm text-muted-foreground py-2 flex items-center gap-2">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary" />
            Wyszukiwanie wolnych łóżek w placówce...
          </div>
        ) : availableBeds.length === 0 ? (
          <div className="text-sm text-foreground bg-muted p-2.5 rounded border border-border">
            Brak wolnych łóżek w innych pokojach placówki.
          </div>
        ) : (
          <NativeSelect
            id="target-bed"
            value={selectedBedId}
            onChange={(e) => setSelectedBedId(e.target.value)}
            className="flex w-full"
            required
          >
            <NativeSelectOption value="" disabled>Wybierz wolne łóżko</NativeSelectOption>
            {availableBeds.map((bed) => (
              <NativeSelectOption key={bed.bedId} value={bed.bedId}>
                Pokój {bed.roomNumber} ({bed.floor}{bed.sector ? `, ${formatSectorName(bed.sector)}` : ''}) — Łóżko {bed.bedLabel}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </div>

      {/* Transparentne reguły i ostrzeżenia */}
      {genderWarning && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted border border-border text-foreground text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 text-foreground mt-0.5" />
          <div>{genderWarning}</div>
        </div>
      )}

      {mobilityWarning && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted border border-border text-foreground text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 text-foreground mt-0.5" />
          <div>{mobilityWarning}</div>
        </div>
      )}

      {selectedOption && !genderWarning && !mobilityWarning && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted border border-border text-foreground text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-foreground" />
          <span>Wybrane miejsce spełnia wszystkie standardy transparentnej alokacji.</span>
        </div>
      )}

      {/* Powód przeniesienia */}
      <div className="space-y-2">
        <Label htmlFor="reassign-reason">Powód zmiany łóżka</Label>
        <NativeSelect
          id="reassign-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="flex w-full"
        >
          <NativeSelectOption value="Dostosowanie do stanu zdrowia">Dostosowanie do stanu zdrowia / mobilności</NativeSelectOption>
          <NativeSelectOption value="Prośba podopiecznego lub rodziny">Prośba podopiecznego lub rodziny</NativeSelectOption>
          <NativeSelectOption value="Optymalizacja struktury pokoi">Optymalizacja struktury placówki / zgodność płci</NativeSelectOption>
          <NativeSelectOption value="Remont lub reorganizacja pokoju">Remont lub reorganizacja pokoju</NativeSelectOption>
          <NativeSelectOption value="Inny powód">Inny powód...</NativeSelectOption>
        </NativeSelect>
        {reason === 'Inny powód' && (
          <input
            type="text"
            placeholder="Wpisz powód przeniesienia..."
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            className="mt-2 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            required
          />
        )}
      </div>
    </div>
  )
}
