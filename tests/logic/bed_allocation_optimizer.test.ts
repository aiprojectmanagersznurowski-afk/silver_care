import { describe, it, expect } from 'vitest'
import {
  isGroundFloor,
  analyzeCurrentAllocation,
  generateRelocationSuggestions,
  OptimizerRoom,
  OptimizerBed,
  OptimizerOccupant,
} from '../../apps/web/src/lib/bed-allocation-optimizer'

/**
 * @REQ: ADM-BED-ASSIGNMENT
 */
describe('Bed Allocation Optimizer Logic (@REQ: ADM-BED-ASSIGNMENT)', () => {
  describe('Helper Functions', () => {
    it('accurately identifies ground floor designations', () => {
      expect(isGroundFloor(0)).toBe(true)
      expect(isGroundFloor('0')).toBe(true)
      expect(isGroundFloor('Parter')).toBe(true)
      expect(isGroundFloor('parter')).toBe(true)
      expect(isGroundFloor('P')).toBe(true)
      expect(isGroundFloor('ground')).toBe(true)

      expect(isGroundFloor(1)).toBe(false)
      expect(isGroundFloor('1')).toBe(false)
      expect(isGroundFloor('2')).toBe(false)
      expect(isGroundFloor('Piętro 1')).toBe(false)
      expect(isGroundFloor(null)).toBe(false)
    })
  })

  describe('analyzeCurrentAllocation', () => {
    const rooms: OptimizerRoom[] = [
      { id: 'r1', number: '101', floor: '0', isActive: true },
      { id: 'r2', number: '102', floor: '0', isActive: true },
      { id: 'r3', number: '201', floor: '1', isActive: true },
    ]

    const beds: OptimizerBed[] = [
      { id: 'b1', roomId: 'r1', label: '1', isActive: true },
      { id: 'b2', roomId: 'r1', label: '2', isActive: true },
      { id: 'b3', roomId: 'r2', label: '1', isActive: true },
      { id: 'b4', roomId: 'r3', label: '1', isActive: true },
      { id: 'b5', roomId: 'r3', label: '2', isActive: true },
    ]

    it('identifies perfect allocation with 100% score when no conflicts exist', () => {
      const occupants: OptimizerOccupant[] = [
        {
          residentId: 'res-1',
          residentName: 'Kowalski Jan',
          gender: 'M',
          careLevel: 'walking',
          isZsn: false,
          currentBedId: 'b1',
          currentRoomId: 'r1',
        },
        {
          residentId: 'res-2',
          residentName: 'Nowak Stefan',
          gender: 'M',
          careLevel: 'bedridden',
          isZsn: false,
          currentBedId: 'b2',
          currentRoomId: 'r1',
        },
      ]

      const metrics = analyzeCurrentAllocation(rooms, beds, occupants)
      expect(metrics.genderConflictsCount).toBe(0)
      expect(metrics.mobilityMismatchCount).toBe(0)
      expect(metrics.overallScore).toBe(100)
      expect(metrics.freeBeds).toBe(3)
    })

    it('detects gender conflict in mixed-gender room', () => {
      const occupants: OptimizerOccupant[] = [
        {
          residentId: 'res-1',
          residentName: 'Kowalski Jan',
          gender: 'M',
          careLevel: 'walking',
          isZsn: false,
          currentBedId: 'b1',
          currentRoomId: 'r1',
        },
        {
          residentId: 'res-2',
          residentName: 'Nowak Anna',
          gender: 'F',
          careLevel: 'walking',
          isZsn: false,
          currentBedId: 'b2',
          currentRoomId: 'r1',
        },
      ]

      const metrics = analyzeCurrentAllocation(rooms, beds, occupants)
      expect(metrics.genderConflictsCount).toBe(1)
      expect(metrics.overallScore).toBeLessThan(100)
      expect(metrics.roomAnalyses[0].hasGenderConflict).toBe(true)
      expect(metrics.roomAnalyses[0].conflicts[0]).toContain('Konflikt płci')
    })

    it('detects mobility mismatch when bedridden resident is placed on upper floor', () => {
      const occupants: OptimizerOccupant[] = [
        {
          residentId: 'res-3',
          residentName: 'Wiśniewski Tomasz',
          gender: 'M',
          careLevel: 'bedridden',
          isZsn: false,
          currentBedId: 'b4',
          currentRoomId: 'r3', // floor: '1'
        },
      ]

      const metrics = analyzeCurrentAllocation(rooms, beds, occupants)
      expect(metrics.mobilityMismatchCount).toBe(1)
      expect(metrics.overallScore).toBeLessThan(100)
      expect(metrics.roomAnalyses[2].hasMobilityMismatch).toBe(true)
      expect(metrics.roomAnalyses[2].conflicts[0]).toContain('Wymagany parter')
    })
  })

  describe('generateRelocationSuggestions', () => {
    it('suggests moving a minority resident to an empty room to solve gender conflict', () => {
      const rooms: OptimizerRoom[] = [
        { id: 'r1', number: '101', floor: '0', isActive: true }, // 2 F, 1 M
        { id: 'r2', number: '102', floor: '0', isActive: true }, // Empty room on ground floor
      ]

      const beds: OptimizerBed[] = [
        { id: 'b1', roomId: 'r1', label: '1', isActive: true },
        { id: 'b2', roomId: 'r1', label: '2', isActive: true },
        { id: 'b3', roomId: 'r1', label: '3', isActive: true },
        { id: 'b4', roomId: 'r2', label: '1', isActive: true },
        { id: 'b5', roomId: 'r2', label: '2', isActive: true },
      ]

      const occupants: OptimizerOccupant[] = [
        {
          residentId: 'res-f1',
          residentName: 'Nowak Anna',
          gender: 'F',
          careLevel: 'walking',
          isZsn: false,
          currentBedId: 'b1',
          currentRoomId: 'r1',
        },
        {
          residentId: 'res-f2',
          residentName: 'Czarna Barbara',
          gender: 'F',
          careLevel: 'sitting',
          isZsn: false,
          currentBedId: 'b2',
          currentRoomId: 'r1',
        },
        {
          residentId: 'res-m1',
          residentName: 'Kowalski Jan',
          gender: 'M',
          careLevel: 'walking',
          isZsn: false,
          currentBedId: 'b3',
          currentRoomId: 'r1',
        },
      ]

      const suggestions = generateRelocationSuggestions(rooms, beds, occupants)
      expect(suggestions.length).toBeGreaterThanOrEqual(1)

      const genderFix = suggestions.find((s) => s.residentId === 'res-m1')
      expect(genderFix).toBeDefined()
      expect(genderFix?.priority).toBe('high')
      expect(genderFix?.toRoomNumber).toBe('102')
      // Kierownik widzi pełne dane: Nazwisko Imię (decyzja Michała 2026-10-26; optymalizator nie wysyła danych do modelu)
      expect(genderFix?.residentName).toMatch(/^\S+ \S+$/)
      expect(genderFix?.residentName).not.toMatch(/^[A-Z?]\. [A-Z?]\.$/)
      expect(genderFix?.reason).toContain('Rozwiązanie konfliktu płci')
    })

    it('suggests moving bedridden resident from upper floor to free ground floor bed', () => {
      const rooms: OptimizerRoom[] = [
        { id: 'r1', number: '101', floor: '0', isActive: true }, // Ground floor, empty bed
        { id: 'r2', number: '201', floor: '1', isActive: true }, // Floor 1
      ]

      const beds: OptimizerBed[] = [
        { id: 'b1', roomId: 'r1', label: 'A', isActive: true },
        { id: 'b2', roomId: 'r2', label: 'A', isActive: true },
      ]

      const occupants: OptimizerOccupant[] = [
        {
          residentId: 'res-bedridden',
          residentName: 'Pawlak Henryk',
          gender: 'F',
          careLevel: 'bedridden',
          isZsn: false,
          currentBedId: 'b2',
          currentRoomId: 'r2',
        },
      ]

      const suggestions = generateRelocationSuggestions(rooms, beds, occupants)
      expect(suggestions.length).toBe(1)
      expect(suggestions[0].residentId).toBe('res-bedridden')
      expect(suggestions[0].residentName).toBe('Pawlak Henryk')
      expect(suggestions[0].toRoomNumber).toBe('101')
      expect(suggestions[0].toFloor).toBe('0')
      expect(suggestions[0].priority).toBe('high')
      expect(suggestions[0].reason).toContain('Alokacja na parter ze względu na poziom opieki')
    })

    it('respects enforceGenderSeparation: false flag and skips gender relocation suggestions', () => {
      const rooms: OptimizerRoom[] = [
        { id: 'r1', number: '101', floor: '0', isActive: true },
        { id: 'r2', number: '102', floor: '0', isActive: true },
      ]
      const beds: OptimizerBed[] = [
        { id: 'b1', roomId: 'r1', label: '1', isActive: true },
        { id: 'b2', roomId: 'r1', label: '2', isActive: true },
        { id: 'b3', roomId: 'r2', label: '1', isActive: true },
      ]
      const occupants: OptimizerOccupant[] = [
        {
          residentId: 'res-f1',
          residentName: 'Kowalska Anna',
          gender: 'F',
          careLevel: 'walking',
          isZsn: false,
          currentBedId: 'b1',
          currentRoomId: 'r1',
        },
        {
          residentId: 'res-m1',
          residentName: 'Nowak Jan',
          gender: 'M',
          careLevel: 'walking',
          isZsn: false,
          currentBedId: 'b2',
          currentRoomId: 'r1',
        },
      ]

      // Default (true) -> should propose moving
      const defaultSuggestions = generateRelocationSuggestions(rooms, beds, occupants)
      expect(defaultSuggestions.some((s) => s.id.startsWith('gender-fix'))).toBe(true)

      // Configured (false) -> should NOT propose moving
      const disabledSuggestions = generateRelocationSuggestions(rooms, beds, occupants, {
        enforceGenderSeparation: false,
        preferGroundFloorForReducedMobility: true,
      })
      expect(disabledSuggestions.some((s) => s.id.startsWith('gender-fix'))).toBe(false)
    })

    it('respects preferGroundFloorForReducedMobility: false flag and skips mobility/ZSN relocations', () => {
      const rooms: OptimizerRoom[] = [
        { id: 'r1', number: '101', floor: '0', isActive: true },
        { id: 'r2', number: '201', floor: '1', isActive: true },
      ]
      const beds: OptimizerBed[] = [
        { id: 'b1', roomId: 'r1', label: 'A', isActive: true },
        { id: 'b2', roomId: 'r2', label: 'A', isActive: true },
      ]
      const occupants: OptimizerOccupant[] = [
        {
          residentId: 'res-bedridden',
          residentName: 'Pawlak Henryk',
          gender: 'M',
          careLevel: 'bedridden',
          isZsn: false,
          currentBedId: 'b2',
          currentRoomId: 'r2',
        },
      ]

      // Default (true) -> should propose moving to ground
      const defaultSuggestions = generateRelocationSuggestions(rooms, beds, occupants)
      expect(defaultSuggestions.some((s) => s.id.startsWith('mobility-fix'))).toBe(true)

      // Configured (false) -> should NOT propose moving to ground
      const disabledSuggestions = generateRelocationSuggestions(rooms, beds, occupants, {
        enforceGenderSeparation: true,
        preferGroundFloorForReducedMobility: false,
      })
      expect(disabledSuggestions.some((s) => s.id.startsWith('mobility-fix'))).toBe(false)
    })
  })
})
