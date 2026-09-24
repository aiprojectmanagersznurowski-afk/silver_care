/**
 * bed-allocation-optimizer.ts — Logika analityczna i optymalizacyjna przydziału łóżek (ADM-AI-BED-ALLOCATION).
 * Zgodność z @REQ: ADM-BED-ASSIGNMENT.
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
  pseudonym: string
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
  residentPseudonym: string
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

export function isGroundFloor(floor: string | number | null | undefined): boolean {
  if (floor === null || floor === undefined) return false
  const f = floor.toString().trim().toLowerCase()
  return f === '0' || f === 'parter' || f === 'p' || f === 'ground'
}

export function pseudonymizeResident(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName || '').trim()
  const l = (lastName || '').trim()
  const fInitial = f.length > 0 ? `${f[0].toUpperCase()}.` : '?'
  const lInitial = l.length > 0 ? `${l[0].toUpperCase()}.` : '?'
  return `${fInitial} ${lInitial}`
}

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
          `${immobileOccupants.length} pensjonariusz(y) leżący/hospicyjny na piętrze ${room.floor}. Wymagany parter.`
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

/**
 * Generowanie inteligentnych propozycji relokacji rozwiązujących konflikty
 */
export function generateRelocationSuggestions(
  rooms: OptimizerRoom[],
  beds: OptimizerBed[],
  occupants: OptimizerOccupant[]
): RelocationSuggestion[] {
  const activeRooms = rooms.filter((r) => r.isActive)
  const activeBeds = beds.filter((b) => b.isActive)

  const roomMap = new Map<string, OptimizerRoom>()
  for (const r of activeRooms) roomMap.set(r.id, r)

  const bedMap = new Map<string, OptimizerBed>()
  for (const b of activeBeds) bedMap.set(b.id, b)

  const occupiedBedIds = new Set<string>(occupants.map((o) => o.currentBedId))
  const freeBeds = activeBeds.filter((b) => !occupiedBedIds.has(b.id))

  const occupantsByRoom = new Map<string, OptimizerOccupant[]>()
  for (const occ of occupants) {
    const list = occupantsByRoom.get(occ.currentRoomId) || []
    list.push(occ)
    occupantsByRoom.set(occ.currentRoomId, list)
  }

  const suggestions: RelocationSuggestion[] = []
  const claimedTargetBedIds = new Set<string>()

  // Krok 1: Rozwiązanie konfliktów płci (Priorytet: HIGH)
  for (const room of activeRooms) {
    const roomOccs = occupantsByRoom.get(room.id) || []
    const mList = roomOccs.filter((o) => o.gender === 'M')
    const fList = roomOccs.filter((o) => o.gender === 'F')

    if (mList.length > 0 && fList.length > 0) {
      // Wybierz mniejszość do przeniesienia
      const toMove = mList.length <= fList.length ? mList : fList
      const targetGender = toMove[0].gender

      for (const occ of toMove) {
        // Znajdź wolne łóżko w pokoju zgodnym płciowo lub pustym
        const candidateBed = freeBeds.find((b) => {
          if (claimedTargetBedIds.has(b.id)) return false
          const targetRoom = roomMap.get(b.roomId)
          if (!targetRoom || targetRoom.id === room.id) return false

          const targetOccupants = occupantsByRoom.get(targetRoom.id) || []
          // Pokój pusty LUB zawiera wyłącznie osoby tej samej płci
          const targetGenders = targetOccupants.map((o) => o.gender)
          const isGenderSafe = targetGenders.length === 0 || targetGenders.every((g) => g === targetGender)
          if (!isGenderSafe) return false

          // Jeśli osoba leżąca, musi być parter
          if ((occ.careLevel === 'bedridden' || occ.careLevel === 'hospice') && !isGroundFloor(targetRoom.floor)) {
            return false
          }
          return true
        })

        if (candidateBed) {
          claimedTargetBedIds.add(candidateBed.id)
          const fromBed = bedMap.get(occ.currentBedId)
          const targetRoom = roomMap.get(candidateBed.roomId)!

          suggestions.push({
            id: `gender-fix-${occ.residentId}`,
            residentId: occ.residentId,
            residentPseudonym: occ.pseudonym,
            gender: occ.gender,
            careLevel: occ.careLevel,
            fromBedId: occ.currentBedId,
            fromBedLabel: fromBed?.label || '-',
            fromRoomId: room.id,
            fromRoomNumber: room.number,
            fromFloor: room.floor,
            toBedId: candidateBed.id,
            toBedLabel: candidateBed.label,
            toRoomId: targetRoom.id,
            toRoomNumber: targetRoom.number,
            toFloor: targetRoom.floor,
            reason: `Rozwiązanie konfliktu płci w pokoju ${room.number}. Przeniesienie do pokoju jednolitego płciowo.`,
            priority: 'high',
            scoreImprovement: 35,
          })
        }
      }
    }
  }

  // Krok 2: Rozwiązanie bariery mobilności dla leżących/hospicyjnych na piętrach > 0 (Priorytet: HIGH)
  for (const occ of occupants) {
    if (occ.careLevel !== 'bedridden' && occ.careLevel !== 'hospice') continue
    const currentRoom = roomMap.get(occ.currentRoomId)
    if (!currentRoom || isGroundFloor(currentRoom.floor)) continue

    // Jeśli już ma propozycję przeniesienia z kroku 1, pomijamy
    if (suggestions.some((s) => s.residentId === occ.residentId)) continue

    // Szukamy wolnego łóżka na parterze zgodnego płciowo
    const groundCandidateBed = freeBeds.find((b) => {
      if (claimedTargetBedIds.has(b.id)) return false
      const targetRoom = roomMap.get(b.roomId)
      if (!targetRoom || !isGroundFloor(targetRoom.floor)) return false

      const targetOccupants = occupantsByRoom.get(targetRoom.id) || []
      const targetGenders = targetOccupants.map((o) => o.gender)
      return targetGenders.length === 0 || targetGenders.every((g) => g === occ.gender)
    })

    if (groundCandidateBed) {
      claimedTargetBedIds.add(groundCandidateBed.id)
      const fromBed = bedMap.get(occ.currentBedId)
      const targetRoom = roomMap.get(groundCandidateBed.roomId)!

      suggestions.push({
        id: `mobility-fix-${occ.residentId}`,
        residentId: occ.residentId,
        residentPseudonym: occ.pseudonym,
        gender: occ.gender,
        careLevel: occ.careLevel,
        fromBedId: occ.currentBedId,
        fromBedLabel: fromBed?.label || '-',
        fromRoomId: currentRoom.id,
        fromRoomNumber: currentRoom.number,
        fromFloor: currentRoom.floor,
        toBedId: groundCandidateBed.id,
        toBedLabel: groundCandidateBed.label,
        toRoomId: targetRoom.id,
        toRoomNumber: targetRoom.number,
        toFloor: targetRoom.floor,
        reason: `Alokacja na parter ze względu na poziom opieki (${occ.careLevel === 'bedridden' ? 'leżący' : 'hospicyjny'}). Ułatwia ewakuację i dostęp opieki.`,
        priority: 'high',
        scoreImprovement: 25,
      })
    }
  }

  // Krok 3: Optymalizacja ZSN na parterze jeśli są wolne łóżka (Priorytet: MEDIUM)
  for (const occ of occupants) {
    if (!occ.isZsn) continue
    const currentRoom = roomMap.get(occ.currentRoomId)
    if (!currentRoom || isGroundFloor(currentRoom.floor)) continue
    if (suggestions.some((s) => s.residentId === occ.residentId)) continue

    const groundCandidateBed = freeBeds.find((b) => {
      if (claimedTargetBedIds.has(b.id)) return false
      const targetRoom = roomMap.get(b.roomId)
      if (!targetRoom || !isGroundFloor(targetRoom.floor)) return false

      const targetOccupants = occupantsByRoom.get(targetRoom.id) || []
      const targetGenders = targetOccupants.map((o) => o.gender)
      return targetGenders.length === 0 || targetGenders.every((g) => g === occ.gender)
    })

    if (groundCandidateBed) {
      claimedTargetBedIds.add(groundCandidateBed.id)
      const fromBed = bedMap.get(occ.currentBedId)
      const targetRoom = roomMap.get(groundCandidateBed.roomId)!

      suggestions.push({
        id: `zsn-ground-${occ.residentId}`,
        residentId: occ.residentId,
        residentPseudonym: occ.pseudonym,
        gender: occ.gender,
        careLevel: occ.careLevel,
        fromBedId: occ.currentBedId,
        fromBedLabel: fromBed?.label || '-',
        fromRoomId: currentRoom.id,
        fromRoomNumber: currentRoom.number,
        fromFloor: currentRoom.floor,
        toBedId: groundCandidateBed.id,
        toBedLabel: groundCandidateBed.label,
        toRoomId: targetRoom.id,
        toRoomNumber: targetRoom.number,
        toFloor: targetRoom.floor,
        reason: 'Pensjonariusz objęty ZSN — przeniesienie na parter bliżej dyżurki personelu.',
        priority: 'medium',
        scoreImprovement: 15,
      })
    }
  }

  return suggestions
}
