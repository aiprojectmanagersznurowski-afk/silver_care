import { describe, it, expect } from 'vitest'
import {
  isGroundFloor,
  pseudonymizeResident,
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
    it('correctly pseudonymizes resident names to initials without exposing PII', () => {
      expect(pseudonymizeResident('Jan', 'Kowalski')).toBe('J. K.')
      expect(pseudonymizeResident('Anna', 'Nowak-Zielińska')).toBe('A. N.')
      expect(pseudonymizeResident('', '')).toBe('? ?')
      expect(pseudonymizeResident(null, undefined)).toBe('? ?')
    })

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
          pseudonym: 'J. K.',
          gender: 'M',
          careLevel: 'walking',
          isZsn: false,
          currentBedId: 'b1',
          currentRoomId: 'r1',
        },
        {
          residentId: 'res-2',
          pseudonym: 'S. N.',
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
          pseudonym: 'J. K.',
          gender: 'M',
          careLevel: 'walking',
          isZsn: false,
          currentBedId: 'b1',
          currentRoomId: 'r1',
        },
        {
          residentId: 'res-2',
          pseudonym: 'A. N.',
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
          pseudonym: 'T. W.',
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
          pseudonym: 'A. N.',
          gender: 'F',
          careLevel: 'walking',
          isZsn: false,
          currentBedId: 'b1',
          currentRoomId: 'r1',
        },
        {
          residentId: 'res-f2',
          pseudonym: 'B. C.',
          gender: 'F',
          careLevel: 'sitting',
          isZsn: false,
          currentBedId: 'b2',
          currentRoomId: 'r1',
        },
        {
          residentId: 'res-m1',
          pseudonym: 'J. K.',
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
          pseudonym: 'H. P.',
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
      expect(suggestions[0].toRoomNumber).toBe('101')
      expect(suggestions[0].toFloor).toBe('0')
      expect(suggestions[0].priority).toBe('high')
      expect(suggestions[0].reason).toContain('Alokacja na parter ze względu na poziom opieki')
    })
  })
})
