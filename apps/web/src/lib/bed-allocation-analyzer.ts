import {
  OptimizerRoom,
  OptimizerBed,
  OptimizerOccupant,
  FacilityAllocationMetrics,
  RoomOccupancyAnalysis,
  isGroundFloor,
} from './bed-allocation-types'

/**
 * Analiza stanu alokacji placówki — identyfikacja konfliktów płciowych i barier mobilności.
 */
export function analyzeCurrentAllocation(
  rooms: OptimizerRoom[],
  beds: OptimizerBed[],
  occupants: OptimizerOccupant[]
): FacilityAllocationMetrics {
  const activeRooms = rooms.filter((r) => r.isActive)
  const activeBeds = beds.filter((b) => b.isActive)

  const occupantsByRoom = new Map<string, OptimizerOccupant[]>()
  for (const occ of occupants) {
    const list = occupantsByRoom.get(occ.currentRoomId) || []
    list.push(occ)
    occupantsByRoom.set(occ.currentRoomId, list)
  }

  const bedsByRoom = new Map<string, OptimizerBed[]>()
  for (const b of activeBeds) {
    const list = bedsByRoom.get(b.roomId) || []
    list.push(b)
    bedsByRoom.set(b.roomId, list)
  }

  let genderConflictsCount = 0
  let mobilityMismatchCount = 0
  const roomAnalyses: RoomOccupancyAnalysis[] = []

  for (const room of activeRooms) {
    const roomOccupants = occupantsByRoom.get(room.id) || []
    const roomBeds = bedsByRoom.get(room.id) || []
    const genders = roomOccupants.map((o) => o.gender)
    const conflicts: string[] = []

    // 1. Konflikt płci w pokoju wieloosobowym
    const hasM = genders.includes('M')
    const hasF = genders.includes('F')
    const hasGenderConflict = hasM && hasF
    if (hasGenderConflict) {
      genderConflictsCount++
      conflicts.push(`Konflikt płci w pokoju ${room.number}: ${genders.filter((g) => g === 'M').length}M / ${genders.filter((g) => g === 'F').length}K.`)
    }

    // 2. Mismatch mobilności (leżący/hospicyjny na wyższym piętrze)
    let roomMobilityMismatch = false
    if (!isGroundFloor(room.floor)) {
      const immobileOccupants = roomOccupants.filter(
        (o) => o.careLevel === 'bedridden' || o.careLevel === 'hospice'
      )
      if (immobileOccupants.length > 0) {
        roomMobilityMismatch = true
        mobilityMismatchCount += immobileOccupants.length
        conflicts.push(
          `Podopieczni leżący lub w opiece hospicyjnej na piętrze ${room.floor}: ${immobileOccupants.length}. Wymagany parter.`
        )
      }
    }

    roomAnalyses.push({
      roomId: room.id,
      roomNumber: room.number,
      floor: room.floor,
      sector: room.sector || null,
      totalBeds: roomBeds.length,
      occupiedBeds: roomOccupants.length,
      genders,
      hasGenderConflict,
      hasMobilityMismatch: roomMobilityMismatch,
      conflicts,
    })
  }

  const totalOccupants = occupants.length
  let score = 100
  if (totalOccupants > 0) {
    const genderPenalty = (genderConflictsCount * 40)
    const mobilityPenalty = (mobilityMismatchCount * 25)
    score = Math.max(0, Math.min(100, Math.round(100 - genderPenalty - mobilityPenalty)))
  }

  return {
    totalRooms: activeRooms.length,
    totalBeds: activeBeds.length,
    occupiedBeds: totalOccupants,
    freeBeds: Math.max(0, activeBeds.length - totalOccupants),
    genderConflictsCount,
    mobilityMismatchCount,
    overallScore: score,
    roomAnalyses,
  }
}
