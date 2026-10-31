import { type CareLevel } from '@/lib/reporting-constants'

export interface BedAssignmentItem {
  id: string
  unassigned_at: string | null
  beds: {
    id: string
    label: string
    rooms: {
      number: string
    } | null
  } | null
}

export interface ResidentWithAssignments {
  id: string
  first_name: string
  last_name: string
  avatar_url?: string | null
  care_level?: CareLevel | null
  is_zsn?: boolean
  archived_at?: string | null
  death_date?: string | null
  admission_date?: string | null
  contract_end_date?: string | null
  contract_end_reason?: string | null
  created_at: string
  bed_assignments?: BedAssignmentItem[]
}

/** Aktywne łóżko podopiecznego albo null, gdy nie ma otwartego przypisania. */
export function getActiveBed(resident: ResidentWithAssignments): BedAssignmentItem['beds'] {
  const active = Array.isArray(resident.bed_assignments)
    ? resident.bed_assignments.filter((a) => a.unassigned_at === null)
    : []
  return active.length > 0 ? active[0].beds : null
}
