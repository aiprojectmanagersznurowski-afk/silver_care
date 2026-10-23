'use client'

import Link from 'next/link'
import { UserCircle2, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { ResidentInlineCareLevel } from '@/components/ResidentInlineCareLevel'
import { ResidentZsnCheckbox } from '@/components/ResidentZsnCheckbox'
import { ResidentEditSheet } from '@/components/ResidentEditSheet'
import { ResidentStatusBadge } from './ResidentStatusBadge'
import { getActiveBed, type ResidentWithAssignments } from './resident-list-types'

export function ResidentGridCard({ resident }: { resident: ResidentWithAssignments }) {
  const activeBed = getActiveBed(resident)

  return (
    <Card className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/admin/residents/${resident.id}`} className="flex items-center gap-3 min-w-0 group">
            <Avatar className="h-11 w-11 border border-border shrink-0">
              {resident.avatar_url && (
                <AvatarImage src={resident.avatar_url} alt={`${resident.first_name} ${resident.last_name}`} />
              )}
              <AvatarFallback className="bg-primary/10 text-primary">
                <UserCircle2 className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <span className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors block truncate">
                {resident.first_name} {resident.last_name}
              </span>
              <BusinessIdBadge type="resident" id={resident.id} />
            </div>
          </Link>

          <div className="flex items-center gap-1 shrink-0">
            <ResidentEditSheet resident={resident} />
            <Link
              href={`/admin/residents/${resident.id}`}
              className="min-h-touch min-w-touch inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
              title="Profil 360°"
              aria-label="Profil 360°"
            >
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-border">
          <div>
            <span className="text-muted-foreground block text-sm">Poziom opieki</span>
            <div className="mt-0.5">
              <ResidentInlineCareLevel residentId={resident.id} initialCareLevel={resident.care_level ?? null} />
            </div>
          </div>
          <div>
            <span className="text-muted-foreground block text-sm">ZSN</span>
            <div className="mt-0.5">
              <ResidentZsnCheckbox residentId={resident.id} initialValue={Boolean(resident.is_zsn)} variant="compact" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-sm pt-2 border-t border-border">
          <span className="text-muted-foreground">
            {activeBed ? `Pok. ${activeBed.rooms?.number}, ł. ${activeBed.label}` : 'Brak przypisanego łóżka'}
          </span>
          <ResidentStatusBadge resident={resident} activeTone="brand" />
        </div>
      </CardContent>
    </Card>
  )
}
