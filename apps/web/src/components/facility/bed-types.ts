export interface BedResident {
  id: string
  first_name: string
  last_name: string
  gender?: 'M' | 'F'
  is_zsn?: boolean
  care_level?: string
}

export interface BedItem {
  id: string
  label: string
  is_active: boolean
  active_assignment?: {
    id: string
    resident_id: string
    resident: BedResident
  } | null
  resident?: BedResident | null
  [key: string]: unknown
}
