'use client'

import React from 'react'
import { BedDouble } from 'lucide-react'
import { TableCell, TableRow } from '@/components/ui/table'
import { BedRowActions, BedResident, BedStatusBadge, bedDisplayLabel, type BedActionsProps } from './BedRowActions'

type BedTableRowProps = BedActionsProps

export function BedTableRow({
  bed,
  roomNumber,
  floor,
  onDeactivate,
  onUnassignClick,
  onRefresh,
}: BedTableRowProps) {
  const displayLabel = bedDisplayLabel(bed)

  return (
    <TableRow className={!bed.is_active ? 'opacity-60 bg-muted/30' : undefined}>
      <TableCell className="font-semibold text-foreground py-2.5">
        <div className="flex items-center gap-2">
          <BedDouble className="w-4 h-4 text-primary shrink-0" />
          <span>{displayLabel}</span>
        </div>
      </TableCell>
      <TableCell className="py-2.5">
        <BedStatusBadge bed={bed} />
      </TableCell>
      <TableCell className="py-2.5">
        <BedResident bed={bed} />
      </TableCell>
      <TableCell className="text-right py-2.5">
        <BedRowActions bed={bed} roomNumber={roomNumber} floor={floor} onDeactivate={onDeactivate} onUnassignClick={onUnassignClick} onRefresh={onRefresh} />
      </TableCell>
    </TableRow>
  )
}
