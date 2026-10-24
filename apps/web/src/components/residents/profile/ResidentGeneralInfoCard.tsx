'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserCircle2, Calendar, Heart, Clock } from 'lucide-react'
import {
  CARE_LEVEL_LABELS,
  CARE_LEVEL_BG_CLASSES,
  GENDER_LABELS,
  CareLevel,
} from '@/lib/reporting-constants'
import { ResidentZsnCheckbox } from '@/components/ResidentZsnCheckbox'
import { FullResidentData } from './profile-types'

interface ResidentGeneralInfoCardProps {
  resident: FullResidentData
  age: number | null
  stayDays: number | null
}

export function ResidentGeneralInfoCard({
  resident,
  age,
  stayDays,
}: ResidentGeneralInfoCardProps) {
  const careLevel = (resident.care_level || 'unknown') as CareLevel | 'unknown'
  const careLevelBg = CARE_LEVEL_BG_CLASSES[careLevel] || 'bg-muted text-foreground'

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="flex items-center gap-2">
          <UserCircle2 className="h-5 w-5 text-primary" />
          Dane osobowe i profil opiekuńczy
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-sm text-muted-foreground block">Płeć</span>
            <span className="text-sm font-medium text-foreground">
              {resident.gender ? GENDER_LABELS[resident.gender as 'M' | 'F'] || resident.gender : 'Nie określono'}
            </span>
          </div>

          <div>
            <span className="text-sm text-muted-foreground block">Wiek</span>
            <span className="text-sm font-medium text-foreground">
              {age !== null ? `${age} lat` : 'Brak danych'}
            </span>
          </div>

          <div>
            <span className="text-sm text-muted-foreground block">Data urodzenia</span>
            <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {resident.birth_date ? resident.birth_date.substring(0, 10) : 'Brak danych'}
            </span>
          </div>

          <div>
            <span className="text-sm text-muted-foreground block">PESEL (skrót kryptograficzny)</span>
            <span className="text-sm font-mono text-muted-foreground">
              {resident.pesel_hash ? `${resident.pesel_hash.substring(0, 12)}…` : 'Brak'}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-border/60 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <span className="text-sm text-muted-foreground block mb-1">Poziom opieki</span>
            <Badge
              variant="outline"
              className={`text-sm font-medium ${careLevelBg}`}
            >
              <Heart className="h-3.5 w-3.5 mr-1" />
              {CARE_LEVEL_LABELS[careLevel] || 'Nie określono'}
            </Badge>
          </div>

          <div>
            <span className="text-sm text-muted-foreground block mb-1">Status ZSN</span>
            <ResidentZsnCheckbox
              residentId={resident.id}
              initialValue={Boolean(resident.is_zsn)}
            />
          </div>

          <div>
            <span className="text-sm text-muted-foreground block">Czas pobytu</span>
            <span className="text-sm font-medium text-foreground flex items-center gap-1.5 mt-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {stayDays !== null ? `${stayDays} dni (od ${resident.admission_date?.substring(0, 10)})` : 'Brak danych'}
            </span>
          </div>
        </div>

        {resident.notes && (
          <div className="pt-3 border-t border-border/60">
            <span className="text-sm text-muted-foreground block mb-1">Uwagi opiekuńcze</span>
            <p className="text-sm text-foreground italic bg-muted/40 p-3 rounded-lg border border-border/60">
              {resident.notes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
