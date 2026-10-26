/**
 * bed-allocation-optimizer.ts — Logika analityczna i optymalizacyjna przydziału łóżek (ADM-AI-BED-ALLOCATION).
 * Zgodność z @REQ: ADM-BED-ASSIGNMENT.
 */

import {
  OptimizerRoom,
  OptimizerBed,
  OptimizerOccupant,
  RelocationSuggestion,
  isGroundFloor,
} from './bed-allocation-types'

export * from './bed-allocation-types'
export { analyzeCurrentAllocation } from './bed-allocation-analyzer'

export interface BedOptimizerRulesConfig {
  enforceGenderSeparation?: boolean
  preferGroundFloorForReducedMobility?: boolean
}

export const DEFAULT_BED_OPTIMIZER_RULES: BedOptimizerRulesConfig = {
  enforceGenderSeparation: true,
  preferGroundFloorForReducedMobility: true,
}

/**
 * Generowanie inteligentnych propozycji relokacji rozwiązujących konflikty
 */
export function generateRelocationSuggestions(
  rooms: OptimizerRoom[],
  beds: OptimizerBed[],
  occupants: OptimizerOccupant[],
  rulesConfig: BedOptimizerRulesConfig = DEFAULT_BED_OPTIMIZER_RULES
): RelocationSuggestion[] {
  const enforceGender = rulesConfig.enforceGenderSeparation !== false
  const preferGround = rulesConfig.preferGroundFloorForReducedMobility !== false

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
  if (enforceGender) {
    for (const room of activeRooms) {
      const roomOccs = occupantsByRoom.get(room.id) || []
      const mList = roomOccs.filter((o) => o.gender === 'M')
      const fList = roomOccs.filter((o) => o.gender === 'F')

      if (mList.length > 0 && fList.length > 0) {
        const toMove = mList.length <= fList.length ? mList : fList
        const targetGender = toMove[0].gender

      for (const occ of toMove) {
        const candidateBed = freeBeds.find((b) => {
          if (claimedTargetBedIds.has(b.id)) return false
          const targetRoom = roomMap.get(b.roomId)
          if (!targetRoom || targetRoom.id === room.id) return false

          const targetOccupants = occupantsByRoom.get(targetRoom.id) || []
          const targetGenders = targetOccupants.map((o) => o.gender)
          const isGenderSafe = targetGenders.length === 0 || targetGenders.every((g) => g === targetGender)
          if (!isGenderSafe) return false

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
            residentName: occ.residentName,
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
}

  // Krok 2: Rozwiązanie bariery mobilności dla leżących/hospicyjnych na piętrach > 0 (Priorytet: HIGH)
  if (preferGround) {
    for (const occ of occupants) {
      if (occ.careLevel !== 'bedridden' && occ.careLevel !== 'hospice') continue
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
          id: `mobility-fix-${occ.residentId}`,
          residentId: occ.residentId,
          residentName: occ.residentName,
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
          residentName: occ.residentName,
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
  }

  return suggestions
}
