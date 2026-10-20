import type { SearchResultItem } from './global-search-helpers'

export interface GlobalSearchResponse {
  success: boolean
  query: string
  items: SearchResultItem[]
  totalCount: number
  error?: string
}

export interface RawRoomWithBeds {
  id: string
  number: string
  floor: number | null
  sector: string | null
  organization_id: string
  beds: Array<{
    id: string
    label: string
    bed_assignments: Array<{
      unassigned_at: string | null
      residents: {
        first_name: string
        last_name: string
      } | null
    }> | null
  }> | null
}

export interface RawBedWithRoom {
  id: string
  label: string
  rooms: {
    id: string
    number: string
    floor: number | null
    sector: string | null
    organization_id: string
  } | null
  bed_assignments: Array<{
    unassigned_at: string | null
    residents: {
      first_name: string
      last_name: string
    } | null
  }> | null
}

export interface RawResidentRow {
  id: string
  first_name: string
  last_name: string
  care_level: string | null
  is_zsn: boolean | null
  bed_assignments: Array<{
    unassigned_at: string | null
    beds: {
      label: string
      rooms: {
        number: string
      } | null
    } | null
  }> | null
}

export interface RawAgendaRow {
  id: string
  title: string
  time: string
  residents: {
    first_name: string
    last_name: string
  } | null
}

export interface RawReportRow {
  id: string
  created_at: string | null
  status: string
  residents: {
    first_name: string
    last_name: string
  } | null
}

export interface RawOrgRow {
  id: string
  name: string
  city: string | null
}

export interface RawSearchResultsPayload {
  resData?: unknown
  roomsData?: unknown
  bedsData?: unknown
  agendaData?: unknown
  reportsData?: unknown
  orgsData?: unknown
}
