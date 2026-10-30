'use client'

import React, { useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { EditResidentDialog } from '@/components/EditResidentDialog'
import { DischargeResidentDialog } from '@/components/DischargeResidentDialog'
import { FullResidentData, ResidentBedAssignment } from './profile-types'
import { formatPersonName } from '@/lib/person-name'
import { hasPendingDeathInitiation } from '@/lib/discharge-helpers'
import { cancelDeathReportAction } from '@/actions/resident-lifecycle-cancel'
import { toast } from 'sonner'

interface ResidentProfileHeaderProps {
  resident: FullResidentData
  isActive: boolean
  /** Sekcja „Edycja i wypis” z kontraktu (kierownik, nie w trybie tylko do odczytu). */
  canManage: boolean
  /** Powrót do listy w części aplikacji właściwej dla roli. */
  backHref: string
  backLabel: string
  activeAssignment?: ResidentBedAssignment | null
}

export function ResidentProfileHeader({
  resident,
  isActive,
  canManage,
  backHref,
  backLabel,
  activeAssignment,
}: ResidentProfileHeaderProps) {
  const [isCancelling, startCancelTransition] = useTransition()
  const activeBedLabel = activeAssignment?.beds
    ? `Pokój ${activeAssignment.beds.rooms?.number || '?'}, Łóżko ${activeAssignment.beds.label}`
    : null
  const pendingDeath = hasPendingDeathInitiation(resident)
  const canNurseInitiateDeath = !canManage && isActive && !pendingDeath && backHref.startsWith('/staff')

  const handleCancelDeathReport = () => {
    if (!confirm('Czy na pewno chcesz anulować zgłoszenie zgonu? Zadania procedury zostaną usunięte.')) return
    startCancelTransition(async () => {
      const res = await cancelDeathReportAction(resident.id)
      if (res.success) {
        toast.success('Anulowano zgłoszenie zgonu.')
      } else {
        toast.error(res.error || 'Błąd podczas anulowania zgłoszenia.')
      }
    })
  }

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
              {pendingDeath ? (
                <StatusBadge>Zgłoszono zgon — do zatwierdzenia</StatusBadge>
              ) : isActive ? (
                <StatusBadge tone="brand">Aktywny pobyt</StatusBadge>
              ) : resident.death_date ? (
                <StatusBadge>Zmarły ({resident.death_date})</StatusBadge>
              ) : (
                <StatusBadge>Zakończony pobyt</StatusBadge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {activeBedLabel
                ? (pendingDeath ? `${activeBedLabel} (zgłoszono zgon — do zatwierdzenia)` : activeBedLabel)
                : 'Brak przypisanego łóżka'}
            </p>
          </div>
        </div>

        {(canManage || canNurseInitiateDeath) && (
          <div className="flex flex-wrap items-center gap-2">
            {canManage && <EditResidentDialog resident={resident} />}

            {canManage && isActive && (
              <DischargeResidentDialog
                resident={{
                  id: resident.id,
                  first_name: resident.first_name,
                  last_name: resident.last_name,
                  death_reported_at: resident.death_reported_at,
                }}
                activeBedLabel={activeBedLabel}
                mode="full"
              />
            )}

            {canManage && pendingDeath && (
              <Button
                variant="outline"
                size="sm"
                className="min-h-touch text-muted-foreground hover:text-destructive"
                disabled={isCancelling}
                onClick={handleCancelDeathReport}
              >
                {isCancelling ? 'Anulowanie...' : 'Anuluj zgłoszenie zgonu'}
              </Button>
            )}

            {canNurseInitiateDeath && (
              <DischargeResidentDialog
                resident={{
                  id: resident.id,
                  first_name: resident.first_name,
                  last_name: resident.last_name,
                  death_reported_at: resident.death_reported_at,
                }}
                activeBedLabel={activeBedLabel}
                mode="nurse_death_init"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

