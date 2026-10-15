import { CareLevel } from '@/lib/reporting-constants'

export interface ResidentBedAssignment {
  id: string
  assigned_at: string
  unassigned_at: string | null
  beds?: {
    id: string
    label: string
    rooms?: {
      number: string
      floor: string
      sector?: string | null
    } | null
  } | null
}

export interface ResidentEventItem {
  id: string
  event_type: string
  event_date: string
  event_reason?: string | null
  metadata?: unknown
  created_at: string
}

export interface ResidentPackageItem {
  id: string
  package_type: string
  package_name: string
  monthly_rate?: number | string | null
  started_at: string
  ended_at?: string | null
}

export interface ResidentRelativeLinkItem {
  id: string
  relative_user_id: string
  relationship_code: string
  role: string
  is_primary_contact?: boolean | null
  created_at: string
}

export interface FullResidentData {
  id: string
  first_name: string
  last_name: string
  birth_date?: string | null
  admission_date?: string | null
  care_level?: CareLevel | string | null
  gender?: 'M' | 'F' | string | null
  notes?: string | null
  is_zsn?: boolean
  pesel_hash?: string | null
  avatar_url?: string | null
  archived_at?: string | null
  death_date?: string | null
  contract_end_date?: string | null
  contract_end_reason?: string | null
  contract_source?: string | null
  contract_document_url?: string | null
  organization_id?: string
  bed_assignments?: ResidentBedAssignment[]
  resident_relative_links?: ResidentRelativeLinkItem[]
  resident_events?: ResidentEventItem[]
  resident_packages?: ResidentPackageItem[]
}
