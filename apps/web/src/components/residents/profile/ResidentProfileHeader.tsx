'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Mic } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { EditResidentDialog } from '@/components/EditResidentDialog'
import { DischargeResidentDialog } from '@/components/DischargeResidentDialog'
import { FullResidentData, ResidentBedAssignment } from './profile-types'
import { formatPersonName } from '@/lib/person-name'

interface ResidentProfileHeaderProps {
  resident: FullResidentData
  isActive: boolean
  /** Sekcja „Edycja i wypis” z kontraktu (kierownik, nie w trybie tylko do odczytu). */
  canManage: boolean
  /** Powrót do listy w części aplikacji właściwej dla roli. */
  backHref: string
  backLabel: string
  activeAssignment?: ResidentBedAssignment | null
  /** Otwarte zadanie zaakceptowane przez personel (SC-ADM-21); nie jest oceną stanu zdrowia. */
  needsAttention?: boolean
  /** Nagranie notatki głosowej o tym podopiecznym (personel, nie w trybie podglądu); identyfikator idzie z UI. */
  voiceNoteHref?: string
}

export function ResidentProfileHeader({
  resident,
  isActive,
  canManage,
  backHref,
  backLabel,
  activeAssignment,
  needsAttention = false,
  voiceNoteHref,
}: ResidentProfileHeaderProps) {
  const activeBedLabel = activeAssignment?.beds
    ? `Pokój ${activeAssignment.beds.rooms?.number || '?'}, Łóżko ${activeAssignment.beds.label}`
    : null

  return (
    <div className="space-y-2">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-touch"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 border border-border sm:size-20">
            {resident.avatar_url && (
              <AvatarImage
                src={resident.avatar_url}
                alt={formatPersonName(resident.first_name, resident.last_name)}
              />
            )}
            <AvatarFallback className="bg-muted text-foreground font-medium text-xl">
              {resident.first_name[0]}
              {resident.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground tracking-tight">
                {formatPersonName(resident.first_name, resident.last_name)}
              </h1>
              <BusinessIdBadge type="resident" id={resident.id} />
              {isActive ? (
                <StatusBadge tone="brand">Aktywny pobyt</StatusBadge>
              ) : resident.death_date ? (
                <StatusBadge>Zmarły ({resident.death_date})</StatusBadge>
              ) : (
                <StatusBadge>Zakończony pobyt</StatusBadge>
              )}
              {needsAttention && (
                <StatusBadge tone="brand" data-testid="resident-attention" title="Podopieczny ma otwarte zadanie do zrobienia">
                  Wymaga uwagi
                </StatusBadge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {activeBedLabel ?? 'Brak przypisanego łóżka'}
            </p>
          </div>
        </div>

        {(canManage || voiceNoteHref) && (
        <div className="flex flex-wrap items-center gap-2">
          {voiceNoteHref && (
            <Link href={voiceNoteHref} className={buttonVariants({ className: 'min-h-touch' })}>
              <Mic className="h-4 w-4" aria-hidden="true" />
              Nagraj notatkę
            </Link>
          )}

          {canManage && <EditResidentDialog resident={resident} />}

          {canManage && isActive && (
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
        )}
      </div>
    </div>
  )
}
