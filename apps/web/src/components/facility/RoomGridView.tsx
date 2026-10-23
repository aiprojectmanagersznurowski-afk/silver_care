'use client'

import React from 'react'
import { DoorOpen, CheckCircle2, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import BedList from './BedList'
import AddBedDialog from './AddBedDialog'
import { isGroundFloor } from '@/lib/bed-allocation-optimizer'
import type { RoomItem } from './room-helpers'
import { getRoomGenderLabel } from './room-helpers'
import { StatusBadge } from '@/components/patterns/StatusBadge'

interface RoomGridViewProps {
  rooms: RoomItem[]
  expandedRooms: Record<string, boolean>
  toggleRoom: (roomId: string) => void
  onUpdate: () => void
  formatSectorName: (sector?: string | null) => string
}

export function RoomGridView({
  rooms,
  expandedRooms,
  toggleRoom,
  onUpdate,
  formatSectorName,
}: RoomGridViewProps) {
  return (
    <div data-slot="object-grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rooms.map((room) => {
        const genderInfo = getRoomGenderLabel(room)
        const isGround = isGroundFloor(room.floor)
        const isExpanded = expandedRooms[room.id]

        return (
          <Card
            key={room.id}
            data-testid="room-card"
            className={`overflow-hidden transition-all duration-200 ${
              isExpanded ? 'ring-2 ring-primary/30' : 'hover:bg-muted/40'
            }`}
          >
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <DoorOpen className="w-5 h-5 text-primary" />
                    <h4 className="font-semibold text-base text-foreground">Pokój {room.number}</h4>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {room.floor} {room.sector ? `• ${formatSectorName(room.sector)}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full ${
                      room.free > 0
                        ? 'bg-muted text-foreground border border-border'
                        : 'bg-muted text-foreground border border-border'
                    }`}
                  >
                    {room.free > 0 ? `${room.free} wolne` : 'Zajęty'}
                  </span>
                </div>
              </div>

              {/* Transparentne reguły alokacji */}
              <div className="flex flex-wrap gap-1.5 text-sm">
                {isGround ? (
                  <StatusBadge>
                    <CheckCircle2 />
                    Parter (ZSN / leżący)
                  </StatusBadge>
                ) : (
                  <StatusBadge>
                    <Info />
                    Wyższe piętro
                  </StatusBadge>
                )}

                <StatusBadge>
                  {genderInfo.variant === 'warning' && <AlertTriangle />}
                  {genderInfo.label}
                </StatusBadge>
              </div>

              {/* Pasek postępu zajętości */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Łóżka ({room.occupied || 0}/{room.beds || 0})</span>
                  <span>{room.free || 0} wolnych</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      room.free === 0 ? 'bg-primary' : 'bg-primary'
                    }`}
                    style={{
                      width: `${room.beds > 0 ? ((room.occupied || 0) / room.beds) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Przycisk rozwijania łóżek */}
              <div className="pt-2 border-t flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleRoom(room.id)}
                  className="text-sm text-primary hover:text-primary font-medium p-0 h-auto"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5 mr-1" />
                      Zwiń łóżka
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5 mr-1" />
                      Zarządzaj łóżkami ({room.beds || 0})
                    </>
                  )}
                </Button>
                <AddBedDialog roomId={room.id} onBedAdded={onUpdate} />
              </div>
            </div>

            {isExpanded && (
              <CardContent className="bg-muted p-4 border-t">
                <BedList
                  roomId={room.id}
                  roomNumber={room.number}
                  floor={room.floor}
                  onUpdate={onUpdate}
                />
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
