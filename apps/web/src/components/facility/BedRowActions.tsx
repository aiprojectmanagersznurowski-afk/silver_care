'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import AssignBedDialog from './AssignBedDialog'
import ReassignBedDialog from './ReassignBedDialog'
import type { BedItem } from './bed-types'

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

/** Pensjonariusz przypisany do łóżka — fakty (płeć, ZSN, poziom opieki), bez oceny. */
export function BedResident({ bed }: { bed: BedItem }) {
  const r = bed.active_assignment?.resident
  if (!r) return <span className="text-sm text-muted-foreground">Brak przypisania</span>
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-foreground">{r.first_name} {r.last_name}</span>
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

/** Akcje łóżka — te same w tabeli i w kafelku. */
export function BedRowActions({ bed, roomNumber, floor, onDeactivate, onUnassignClick, onRefresh }: BedActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1.5 flex-wrap">
      {bed.is_active ? (
        <>
          {bed.active_assignment ? (
            <>
              <ReassignBedDialog
                currentBedId={bed.id}
                currentBedLabel={bed.label}
                currentRoomNumber={roomNumber || ''}
                currentFloor={floor}
                residentId={bed.active_assignment.resident.id}
                residentName={`${bed.active_assignment.resident.first_name} ${bed.active_assignment.resident.last_name}`}
                residentGender={bed.active_assignment.resident.gender}
                residentIsZsn={bed.active_assignment.resident.is_zsn}
                residentCareLevel={bed.active_assignment.resident.care_level}
                onReassigned={onRefresh}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-touch px-2.5 text-sm text-foreground hover:bg-muted"
                    onClick={() => {
                      if (bed.active_assignment?.resident) {
                        onUnassignClick({
                          bedId: bed.id,
                          residentId: bed.active_assignment.resident.id,
                          residentName: `${bed.active_assignment.resident.first_name} ${bed.active_assignment.resident.last_name}`,
                        })
                      }
                    }}
                  >
                    Wypisz
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Zwolnij to łóżko i usuń bieżące przypisanie pensjonariusza
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            <AssignBedDialog
              bedId={bed.id}
              onAssigned={onRefresh}
            />
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-touch px-2.5 text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => onDeactivate(bed.id, false)}
                  disabled={!!bed.active_assignment}
                >
                  Dezaktywuj
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {bed.active_assignment
                ? 'Nie można dezaktywować zajętego łóżka — najpierw wypisz pensjonariusza'
                : 'Wyłącz łóżko z puli dostępnych w placówce'}
            </TooltipContent>
          </Tooltip>
        </>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeactivate(bed.id, true)}
              className="min-h-touch px-3 text-sm"
            >
              Aktywuj łóżko
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Przywróć łóżko do puli dostępnych do przypisania
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
