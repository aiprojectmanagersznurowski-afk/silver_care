'use client'

import React, { Fragment } from 'react'
import { DoorOpen, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import BedList from './BedList'
import { RoomRowActions } from './RoomRowActions'
import { isGroundFloor } from '@/lib/bed-allocation-optimizer'
import type { RoomItem } from './room-helpers'
import { getRoomGenderLabel } from './room-helpers'

interface RoomTableViewProps {
  rooms: RoomItem[]
  expandedRooms: Record<string, boolean>
  toggleRoom: (roomId: string) => void
  onUpdate: () => void
  formatSectorName: (sector?: string | null) => string
}

export function RoomTableView({
  rooms,
  expandedRooms,
  toggleRoom,
  onUpdate,
  formatSectorName,
}: RoomTableViewProps) {
  return (
    <div data-testid="room-table">
      <div>
        <Table>
          <TableHeader className="font-semibold text-muted-foreground">
            <TableRow>
              <TableHead>Pokój</TableHead>
              <TableHead>Piętro</TableHead>
              <TableHead>Sektor</TableHead>
              <TableHead className="text-center">Łóżka</TableHead>
              <TableHead className="text-center">Obłożenie</TableHead>
              <TableHead>Reguły alokacji</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room) => {
              const genderInfo = getRoomGenderLabel(room)
              const isGround = isGroundFloor(room.floor)
              const isExpanded = expandedRooms[room.id]

              return (
                <Fragment key={room.id}>
                  <TableRow
                    className={isExpanded ? 'bg-muted/30 border-b-0' : undefined}
                  >
                    <TableCell className="font-semibold text-foreground">
                      <div className="flex items-center gap-2">
                        <DoorOpen className="w-4 h-4 text-primary" />
                        <span>Pokój {room.number}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{room.floor}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {room.sector ? formatSectorName(room.sector) : '—'}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {room.beds || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium bg-muted text-foreground">
                        {room.occupied || 0} / {room.beds || 0} ({room.free || 0} wolnych)
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5 text-sm">
                        {isGround && (
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-sm font-medium text-foreground">
                            Parter
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-sm font-medium bg-muted text-foreground">
                          {genderInfo.variant === 'warning' && (
                            <AlertTriangle className="w-3 h-3 text-foreground" />
                          )}
                          {genderInfo.label}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          aria-expanded={!!isExpanded}
                          onClick={() => toggleRoom(room.id)}
                          className="text-primary hover:text-primary"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5 mr-1" />
                              Zwiń
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5 mr-1" />
                              Łóżka
                            </>
                          )}
                        </Button>
                        <RoomRowActions roomId={room.id} onBedAdded={onUpdate} />
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow
                      key={`${room.id}-expanded`}
                      className="bg-muted/10 hover:bg-muted/10 border-t-0"
                      data-testid="room-expanded-beds"
                    >
                      <TableCell colSpan={7} className="p-4 pt-1 pb-4">
                        <div className="rounded-lg border border-border/80 bg-background/90 p-4 shadow-none">
                          <div className="mb-3 flex items-center justify-between text-sm font-medium text-muted-foreground">
                            <span>
                              Łóżka w pokoju {room.number} ({room.occupied || 0}/{room.beds || 0} zajęte)
                            </span>
                            <span>{room.free || 0} wolnych</span>
                          </div>
                          <BedList
                            roomId={room.id}
                            roomNumber={room.number}
                            floor={room.floor}
                            onUpdate={onUpdate}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
