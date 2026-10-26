/**
 * bed-allocation-types.ts — Typy i helpery bazowe dla modułu alokacji łóżek.
 */

export interface OptimizerRoom {
  id: string
  number: string
  floor: string
  sector?: string | null
  isActive: boolean
}

export interface OptimizerBed {
  id: string
  roomId: string
  label: string
  isActive: boolean
}

export interface OptimizerOccupant {
  residentId: string
  /** Nazwisko Imię — kierownik placówki decyduje o przeniesieniu konkretnej osoby */
  residentName: string
  gender: 'M' | 'F'
  careLevel: 'walking' | 'sitting' | 'bedridden' | 'hospice'
  isZsn: boolean
  currentBedId: string
  currentRoomId: string
}

export interface RoomOccupancyAnalysis {
  roomId: string
  roomNumber: string
  floor: string
  sector: string | null
  totalBeds: number
  occupiedBeds: number
  genders: Array<'M' | 'F'>
  hasGenderConflict: boolean
  hasMobilityMismatch: boolean
  conflicts: string[]
}

export interface FacilityAllocationMetrics {
  totalRooms: number
  totalBeds: number
  occupiedBeds: number
  freeBeds: number
  genderConflictsCount: number
  mobilityMismatchCount: number
  overallScore: number // 0 to 100%
  roomAnalyses: RoomOccupancyAnalysis[]
}

export interface RelocationSuggestion {
  id: string
  residentId: string
  residentName: string
  gender: 'M' | 'F'
  careLevel: string
  fromBedId: string
  fromBedLabel: string
  fromRoomId: string
  fromRoomNumber: string
  fromFloor: string
  toBedId: string
  toBedLabel: string
  toRoomId: string
  toRoomNumber: string
  toFloor: string
  reason: string
  priority: 'high' | 'medium' | 'low'
  scoreImprovement: number
}

export interface RawResidentAssignment {
  bed_id: string
  resident_id: string
  residents: {
    id: string
    first_name: string
    last_name: string
    gender: string
    care_level: string
    is_zsn: boolean
    archived_at: string | null
  } | null
}

export interface RawBedWithRoom {
  id: string
  rooms: {
    organization_id: string
  } | null
}

export function isGroundFloor(floor: string | number | null | undefined): boolean {
  if (floor === null || floor === undefined) return false
  const f = floor.toString().trim().toLowerCase()
  return f === '0' || f === 'parter' || f === 'p' || f === 'ground'
}

