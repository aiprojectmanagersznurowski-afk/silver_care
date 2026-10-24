'use client'

import React from 'react'
import { BedDouble } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { TableCell, TableRow } from '@/components/ui/table'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import AssignBedDialog from './AssignBedDialog'
import ReassignBedDialog from './ReassignBedDialog'
import type { BedItem } from './bed-types'
import { StatusBadge } from '@/components/patterns/StatusBadge'

interface BedTableRowProps {
  bed: BedItem
  roomNumber?: string
  floor?: string
  onDeactivate: (bedId: string, is_active: boolean) => void
  onUnassignClick: (target: { bedId: string; residentId: string; residentName: string }) => void
  onRefresh: () => void
}

export function BedTableRow({
  bed,
  roomNumber,
  floor,
  onDeactivate,
  onUnassignClick,
  onRefresh,
}: BedTableRowProps) {
  const displayLabel =
    bed.label.toLowerCase().startsWith('łóżko') || bed.label.toLowerCase().startsWith('lozko')
      ? bed.label
      : `Łóżko ${bed.label}`

  return (
    <TableRow className={!bed.is_active ? 'opacity-60 bg-muted/30' : undefined}>
      <TableCell className="font-semibold text-foreground py-2.5">
        <div className="flex items-center gap-2">
          <BedDouble className="w-4 h-4 text-primary shrink-0" />
          <span>{displayLabel}</span>
        </div>
      </TableCell>
      <TableCell className="py-2.5">
        {!bed.is_active ? (
          <StatusBadge>Nieaktywne</StatusBadge>
        ) : bed.active_assignment ? (
          <StatusBadge tone="brand">Zajęte</StatusBadge>
        ) : (
          <StatusBadge>Wolne</StatusBadge>
        )}
      </TableCell>
      <TableCell className="py-2.5">
        {bed.active_assignment ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground">
                {bed.active_assignment.resident.first_name} {bed.active_assignment.resident.last_name}
              </span>
              <BusinessIdBadge type="resident" id={bed.active_assignment.resident.id} />
            </div>
            <div className="flex flex-wrap gap-1 text-sm">
              {bed.active_assignment.resident.gender && (
                <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground">
                  {bed.active_assignment.resident.gender === 'M' ? 'Mężczyzna' : 'Kobieta'}
                </span>
              )}
              {bed.active_assignment.resident.is_zsn && (
                <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground">
                  ZSN
                </span>
              )}
              {bed.active_assignment.resident.care_level && (
                <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground">
                  {bed.active_assignment.resident.care_level === 'bedridden'
                    ? 'Leżący'
                    : bed.active_assignment.resident.care_level === 'sitting'
                    ? 'Na wózku'
                    : 'Chodzący'}
                </span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Brak przypisania</span>
        )}
      </TableCell>
      <TableCell className="text-right py-2.5">
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
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2.5 text-sm"
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
                      className="h-8 px-2.5 text-sm text-muted-foreground hover:text-foreground"
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
                  className="h-8 px-3 text-sm"
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
      </TableCell>
    </TableRow>
  )
}
