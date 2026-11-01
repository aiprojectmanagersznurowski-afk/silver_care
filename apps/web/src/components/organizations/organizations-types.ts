export interface OrganizationSummaryItem {
  organization_id: string
  organization_name: string
  address?: string | null
  resident_limit: number
  created_at: string
  active_resident_count: number
  staff_count: number
  administrator_count: number
  /** ADM-CAPACITY-LIMIT: aktywne łóżka i znacznik przekroczenia limitu miejsc (łóżka albo podopieczni). */
  active_bed_count: number
  over_capacity_limit: boolean
}

export interface OrganizationsManagementClientProps {
  initialOrganizations: OrganizationSummaryItem[]
  errorMessage?: string
  forcedState?: 'loading' | 'empty' | 'success' | 'error'
  renderActionSlot?: React.ReactNode
}
