'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BedDouble, MapPin, Clock } from 'lucide-react'
import { ResidentBedAssignment } from './profile-types'
import { formatSectorName } from '@/lib/sector'

interface ResidentBedInfoCardProps {
  activeAssignment?: ResidentBedAssignment | null
  pastAssignments: ResidentBedAssignment[]
}

export function ResidentBedInfoCard({
  activeAssignment,
  pastAssignments,
}: ResidentBedInfoCardProps) {
  const currentBed = activeAssignment?.beds
  const currentRoom = currentBed?.rooms

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="flex items-center gap-2">
          <BedDouble className="h-5 w-5 text-primary" />
          Lokalizacja i historia łóżek
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {activeAssignment && currentBed && currentRoom ? (
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" />
                Pokój {currentRoom.number}, Łóżko {currentBed.label}
              </span>
              <span className="text-sm text-muted-foreground">
                Od: {activeAssignment.assigned_at?.substring(0, 10)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground pt-1">
              <div>Piętro: <strong className="text-foreground">{currentRoom.floor}</strong></div>
              <div>Sektor: <strong className="text-foreground">{formatSectorName(currentRoom.sector)}</strong></div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
            Brak aktywnego przypisania łóżka.
          </div>
        )}

        {pastAssignments.length > 0 && (
          <div className="pt-3 border-t border-border/60 space-y-2">
            <span className="text-sm font-semibold text-muted-foreground block">
              Poprzednie przypisania ({pastAssignments.length})
            </span>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {pastAssignments.map((pa) => {
                const b = pa.beds
                const r = b?.rooms
                return (
                  <div
                    key={pa.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 text-sm bg-muted/30"
                  >
                    <div>
                      <span className="font-medium text-foreground">
                        Pokój {r?.number || '?'}, Łóżko {b?.label || '?'}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        (Piętro {r?.floor || '?'})
                      </span>
                    </div>
                    <span className="text-muted-foreground flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3" />
                      {pa.assigned_at?.substring(0, 10)} &rarr; {pa.unassigned_at?.substring(0, 10)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
