'use client'

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { UserCircle2, ChevronRight } from 'lucide-react'
import { ResidentEditSheet } from '@/components/ResidentEditSheet'
import { ResidentInlineCareLevel } from '@/components/ResidentInlineCareLevel'
import { ResidentZsnCheckbox } from '@/components/ResidentZsnCheckbox'
import { type CareLevel } from '@/lib/reporting-constants'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

export interface ResidentMobileItem {
  id: string
  first_name: string
  last_name: string
  avatar_url?: string | null
  care_level?: CareLevel | null
  is_zsn?: boolean
  archived_at?: string | null
  death_date?: string | null
  created_at?: string
  admission_date?: string | null
  bed_assignments?: Array<{
    unassigned_at: string | null
    beds: {
      label: string
      rooms: { number: string } | null
    } | null
  }>
}

interface ResidentMobileCardProps {
  resident: ResidentMobileItem
}

export function ResidentMobileCard({ resident }: ResidentMobileCardProps) {
  const activeAssignments = (resident.bed_assignments || []).filter(
    (a) => a.unassigned_at === null
  )
  const activeBed = activeAssignments[0]?.beds ?? null

  const statusBadge = resident.archived_at
    ? { label: 'Zarchiwizowany', className: 'bg-slate/10 text-slate-soft border-none text-xs' }
    : resident.death_date
    ? { label: 'Zgon', className: 'bg-slate/10 text-slate-soft border-none text-xs' }
    : { label: 'Aktywny', className: 'bg-emerald-50 text-emerald-700 border-none text-xs' }

  const admissionDate = resident.admission_date
    ? format(new Date(resident.admission_date), 'd MMM yyyy', { locale: pl })
    : resident.created_at
    ? format(new Date(resident.created_at), 'd MMM yyyy', { locale: pl })
    : '—'

  return (
    <div
      data-testid="resident-mobile-card"
      className="flex flex-col gap-3 bg-white rounded-2xl p-4 ring-1 ring-slate/5 shadow-xs"
    >
      <div className="flex items-center gap-3">
        {/* Avatar z linkiem do profilu */}
        <Link href={`/admin/residents/${resident.id}`} className="shrink-0">
          <Avatar className="h-12 w-12 border border-slate/10">
            {resident.avatar_url && (
              <AvatarImage src={resident.avatar_url} alt={`${resident.first_name} ${resident.last_name}`} />
            )}
            <AvatarFallback className="bg-sage/10 text-sage">
              <UserCircle2 className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
        </Link>

        {/* Imię, nazwisko i status */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/admin/residents/${resident.id}`}
            className="font-medium text-slate text-base hover:text-sage transition-colors truncate block"
          >
            {resident.first_name} {resident.last_name}
          </Link>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
            {activeBed ? (
              <span className="text-xs text-slate-soft">
                Pok. {activeBed.rooms?.number}, ł. {activeBed.label}
              </span>
            ) : (
              <span className="text-xs text-slate-soft/50">Brak pokoju</span>
            )}
          </div>
        </div>

        {/* Akcje: Sheet i Link do profilu */}
        <div className="flex items-center gap-1 shrink-0">
          <ResidentEditSheet
            resident={{
              id: resident.id,
              first_name: resident.first_name,
              last_name: resident.last_name,
              care_level: resident.care_level ?? null,
              is_zsn: resident.is_zsn,
              admission_date: resident.admission_date,
            }}
          />
          <Link
            href={`/admin/residents/${resident.id}`}
            className="p-2 text-slate-soft/50 hover:text-sage transition-colors min-h-[48px] min-w-[48px] inline-flex items-center justify-center rounded-lg hover:bg-slate/5"
            title="Profil 360°"
            aria-label={`Profil 360° ${resident.first_name} ${resident.last_name}`}
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Dolny pasek karty mobilnej: data przyjęcia + kontrole inline */}
      <div className="flex items-center justify-between border-t border-slate/5 pt-2 mt-1">
        <div className="text-xs text-slate-soft">
          Przyjęcie: <span className="font-medium text-slate">{admissionDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <ResidentInlineCareLevel
            residentId={resident.id}
            initialCareLevel={resident.care_level ?? null}
          />
          <ResidentZsnCheckbox
            residentId={resident.id}
            initialValue={Boolean(resident.is_zsn)}
            variant="compact"
          />
        </div>
      </div>
    </div>
  )
}
