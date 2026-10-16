'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { EditResidentDialog } from '@/components/EditResidentDialog'
import { DischargeResidentDialog } from '@/components/DischargeResidentDialog'
import { FullResidentData, ResidentBedAssignment } from './profile-types'

interface ResidentProfileHeaderProps {
  resident: FullResidentData
  isActive: boolean
  isImpersonating: boolean
  activeAssignment?: ResidentBedAssignment | null
}

export function ResidentProfileHeader({
  resident,
  isActive,
  isImpersonating,
  activeAssignment,
}: ResidentProfileHeaderProps) {
  const activeBedLabel = activeAssignment?.beds
    ? `Pokój ${activeAssignment.beds.rooms?.number || '?'}, Łóżko ${activeAssignment.beds.label}`
    : null

  return (
    <div className="space-y-4">
      <Link
        href="/admin/residents"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-11"
      >
        <ArrowLeft className="h-4 w-4" />
        Wróć do listy podopiecznych
      </Link>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-border">
            {resident.avatar_url && (
              <AvatarImage
                src={resident.avatar_url}
                alt={`${resident.first_name} ${resident.last_name}`}
              />
            )}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
              {resident.first_name[0]}
              {resident.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground tracking-tight">
                {resident.first_name} {resident.last_name}
              </h1>
              <BusinessIdBadge type="resident" id={resident.id} />
              {isActive ? (
                <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-sm">
                  Aktywny pobyt
                </Badge>
              ) : resident.death_date ? (
                <Badge variant="outline" className="border-border text-muted-foreground bg-muted text-sm">
                  Zmarły ({resident.death_date})
                </Badge>
              ) : (
                <Badge variant="outline" className="border-border text-muted-foreground bg-muted text-sm">
                  Zakończony pobyt
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Szczegółowa kartoteka pensjonariusza, dane opiekuńcze i historia zdarzeń.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
          <EditResidentDialog resident={resident} />

          {isActive && !isImpersonating && (
            <DischargeResidentDialog
              resident={{
                id: resident.id,
                first_name: resident.first_name,
                last_name: resident.last_name,
              }}
              activeBedLabel={activeBedLabel}
            />
          )}
        </div>
      </div>
    </div>
  )
}
