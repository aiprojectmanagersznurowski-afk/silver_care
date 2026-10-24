import { StatusBadge } from '@/components/patterns/StatusBadge'
import { getResidentStatus } from '@/lib/resident-status'
import type { ResidentWithAssignments } from './resident-list-types'

interface ResidentStatusBadgeProps {
  resident: Pick<ResidentWithAssignments, 'archived_at' | 'death_date' | 'contract_end_date'>
  /** Kafelki oznaczają aktywnego kolorem marki, tabela pozostaje neutralna. */
  activeTone?: 'brand' | 'neutral'
}

export function ResidentStatusBadge({ resident, activeTone = 'neutral' }: ResidentStatusBadgeProps) {
  const { kind, label } = getResidentStatus(resident)
  return <StatusBadge tone={kind === 'active' ? activeTone : 'neutral'}>{label}</StatusBadge>
}
