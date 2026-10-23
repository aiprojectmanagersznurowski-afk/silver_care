import { Badge } from '@/components/ui/badge'
import type { ResidentWithAssignments } from './resident-list-types'

interface ResidentStatusBadgeProps {
  resident: ResidentWithAssignments
  /** Kafelki oznaczają aktywnego kolorem marki, tabela pozostaje neutralna. */
  activeTone?: 'brand' | 'neutral'
}

export function ResidentStatusBadge({ resident, activeTone = 'neutral' }: ResidentStatusBadgeProps) {
  if (resident.archived_at) {
    return <Badge className="bg-muted text-muted-foreground border-none text-sm">Zarchiwizowany</Badge>
  }
  if (resident.death_date) {
    return <Badge className="bg-muted text-foreground border-none text-sm">Zgon</Badge>
  }
  if (resident.contract_end_date && new Date(resident.contract_end_date) <= new Date()) {
    return <Badge className="bg-muted text-muted-foreground border-none text-sm">Wypisany</Badge>
  }
  return (
    <Badge
      className={`border-none text-sm ${
        activeTone === 'brand' ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground'
      }`}
    >
      Aktywny
    </Badge>
  )
}
