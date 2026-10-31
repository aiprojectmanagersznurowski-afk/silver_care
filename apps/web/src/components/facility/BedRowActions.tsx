'use client'

import React, { useState } from 'react'
import { ArrowRightLeft, LogOut, Power, PowerOff, UserPlus } from 'lucide-react'
import { RowActions, type RowAction } from '@/components/patterns/RowActions'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import AssignBedDialog from './AssignBedDialog'
import ReassignBedDialog from './ReassignBedDialog'
import type { BedItem } from './bed-types'
import { formatPersonName } from '@/lib/person-name'

export interface BedActionsProps {
  bed: BedItem
  roomNumber?: string
  floor?: string
  onDeactivate: (bedId: string, is_active: boolean) => void
  onUnassignClick: (target: { bedId: string; residentId: string; residentName: string }) => void
  onRefresh: () => void
}

export const bedDisplayLabel = (bed: BedItem) =>
  bed.label.toLowerCase().startsWith('łóżko') || bed.label.toLowerCase().startsWith('lozko') ? bed.label : `Łóżko ${bed.label}`

export function BedStatusBadge({ bed }: { bed: BedItem }) {
  if (!bed.is_active) return <StatusBadge>Nieaktywne</StatusBadge>
  if (bed.active_assignment) return <StatusBadge tone="brand">Zajęte</StatusBadge>
  return <StatusBadge>Wolne</StatusBadge>
}

const CARE_LABEL: Record<string, string> = { bedridden: 'Leżący', sitting: 'Na wózku' }

/** Podopieczny przypisany do łóżka — fakty (płeć, ZSN, poziom opieki), bez oceny. */
export function BedResident({ bed }: { bed: BedItem }) {
  const r = bed.active_assignment?.resident
  if (!r) return <span className="text-sm text-muted-foreground">Brak przypisania</span>
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-foreground">{formatPersonName(r.first_name, r.last_name)}</span>
        <BusinessIdBadge type="resident" id={r.id} />
      </div>
      <div className="flex flex-wrap gap-1">
        {r.gender && <StatusBadge>{r.gender === 'M' ? 'Mężczyzna' : 'Kobieta'}</StatusBadge>}
        {r.is_zsn && <StatusBadge>ZSN</StatusBadge>}
        {r.care_level && <StatusBadge>{CARE_LABEL[r.care_level] ?? 'Chodzący'}</StatusBadge>}
      </div>
    </div>
  )
}

/** Akcje łóżka w menu „⋯" — te same w tabeli i w kafelku. */
export function BedRowActions({ bed, roomNumber, floor, onDeactivate, onUnassignClick, onRefresh }: BedActionsProps) {
  const [dialog, setDialog] = useState<'none' | 'assign' | 'reassign'>('none')
  const close = (open: boolean) => !open && setDialog('none')
  const resident = bed.active_assignment?.resident
  const residentName = resident ? formatPersonName(resident.first_name, resident.last_name) : ''

  const actions: RowAction[] = !bed.is_active
    ? [{ label: 'Aktywuj łóżko', icon: Power, hint: 'Przywróć łóżko do puli dostępnych do przypisania', onSelect: () => onDeactivate(bed.id, true) }]
    : [
        ...(resident
          ? [
              { label: 'Zmień łóżko', icon: ArrowRightLeft, onSelect: () => setDialog('reassign') },
              {
                label: 'Wypisz',
                icon: LogOut,
                hint: 'Zwolnij to łóżko i usuń bieżące przypisanie podopiecznego',
                onSelect: () => onUnassignClick({ bedId: bed.id, residentId: resident.id, residentName }),
              },
            ]
          : [{ label: 'Przypisz', icon: UserPlus, onSelect: () => setDialog('assign') }]),
        {
          label: 'Dezaktywuj',
          icon: PowerOff,
          separated: true,
          disabled: !!resident,
          hint: resident
            ? 'Nie można dezaktywować zajętego łóżka — najpierw wypisz podopiecznego'
            : 'Wyłącz łóżko z puli dostępnych w placówce',
          onSelect: () => onDeactivate(bed.id, false),
        },
      ]

  return (
    <RowActions label={bedDisplayLabel(bed)} actions={actions}>
      {dialog === 'assign' && <AssignBedDialog bedId={bed.id} onAssigned={onRefresh} open onOpenChange={close} />}
      {dialog === 'reassign' && resident && (
        <ReassignBedDialog
          currentBedId={bed.id}
          currentBedLabel={bed.label}
          currentRoomNumber={roomNumber || ''}
          currentFloor={floor}
          residentId={resident.id}
          residentName={residentName}
          residentGender={resident.gender}
          residentIsZsn={resident.is_zsn}
          residentCareLevel={resident.care_level}
          onReassigned={onRefresh}
          open
          onOpenChange={close}
        />
      )}
    </RowActions>
  )
}
