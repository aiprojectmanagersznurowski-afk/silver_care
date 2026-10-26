'use client'

import Link from 'next/link'
import { UserCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { ResidentInlineCareLevel } from '@/components/ResidentInlineCareLevel'
import { ResidentZsnCheckbox } from '@/components/ResidentZsnCheckbox'
import { ResidentRowActions } from './ResidentRowActions'
import { ResidentStatusBadge } from './ResidentStatusBadge'
import { getActiveBed, type ResidentWithAssignments } from './resident-list-types'
import { formatPersonName } from '@/lib/person-name'

export function ResidentGridCard({ resident }: { resident: ResidentWithAssignments }) {
  const activeBed = getActiveBed(resident)

  return (
    <Card className="overflow-hidden hover:border-primary/50 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/admin/residents/${resident.id}`} className="flex items-center gap-3 min-w-0 group">
            <Avatar className="h-11 w-11 border border-border shrink-0">
              {resident.avatar_url && (
                <AvatarImage src={resident.avatar_url} alt={formatPersonName(resident.first_name, resident.last_name)} />
              )}
              <AvatarFallback className="bg-primary/10 text-primary">
                <UserCircle2 className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <span className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors block truncate">
                {formatPersonName(resident.first_name, resident.last_name)}
              </span>
              <BusinessIdBadge type="resident" id={resident.id} />
            </div>
          </Link>

          <ResidentRowActions resident={resident} />
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
