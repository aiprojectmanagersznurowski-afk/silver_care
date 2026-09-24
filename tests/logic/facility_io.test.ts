import { describe, it, expect } from 'vitest'
import {
  validateFacilityRows,
  parseFacilityVoiceJson,
  RawFacilityRoomRow,
} from '../../apps/web/src/lib/facility-helpers'

/**
 * @REQ: ADM-FACILITY-MANAGE
 * @REQ: ADM-FACILITY-OCCUPANCY
 */
describe('Facility Structure IO & Voice Helpers (@REQ: ADM-FACILITY-MANAGE, @REQ: ADM-FACILITY-OCCUPANCY)', () => {
  describe('validateFacilityRows', () => {
    it('validates correct room and bed rows with explicit bed labels', () => {
      const rawRows: RawFacilityRoomRow[] = [
        {
          floor: 'Parter',
          number: '101',
          sector: 'Skrzydło A',
          bedLabels: '1, 2, 3',
        },
        {
          floor: '1',
          number: '202',
          sector: 'Skrzydło B',
          bedCount: 2,
        },
      ]

      const existingRooms = new Set<string>(['999'])
      const result = validateFacilityRows(rawRows, existingRooms)

      expect(result.totalRows).toBe(2)
      expect(result.validRowsCount).toBe(2)
      expect(result.invalidRowsCount).toBe(0)
      expect(result.rows[0].bedLabels).toEqual(['1', '2', '3'])
      expect(result.rows[1].bedLabels).toEqual(['1', '2'])
    })

    it('rejects duplicate room numbers in file and existing rooms in facility', () => {
      const rawRows: RawFacilityRoomRow[] = [
        {
          floor: 'Parter',
          number: '101',
          bedCount: 1,
        },
        {
          floor: 'Parter',
          number: '101', // duplicate in file
          bedCount: 2,
        },
        {
          floor: '1',
          number: 'ExistingRoom',
          bedCount: 1,
        },
      ]

      const existingRooms = new Set<string>(['ExistingRoom'])
      const result = validateFacilityRows(rawRows, existingRooms)

      expect(result.totalRows).toBe(3)
      expect(result.validRowsCount).toBe(1)
      expect(result.invalidRowsCount).toBe(2)

      expect(result.rows[1].errors[0]).toContain('Duplikat numeru pokoju "101"')
      expect(result.rows[2].errors[0]).toContain('już istnieje w bazie placówki')
    })

    it('flags missing floor, missing room number, and duplicate bed labels', () => {
      const rawRows: RawFacilityRoomRow[] = [
        {
          floor: '',
          number: '102',
          bedCount: 1,
        },
        {
          floor: 'Parter',
          number: '',
          bedCount: 1,
        },
        {
          floor: 'Parter',
          number: '103',
          bedLabels: 'A, A', // duplicate bed label in same room
        },
      ]

      const result = validateFacilityRows(rawRows, new Set())
      expect(result.validRowsCount).toBe(0)
      expect(result.rows[0].errors).toContain('Brak oznaczenia piętra.')
      expect(result.rows[1].errors).toContain('Brak numeru pokoju.')
      expect(result.rows[2].errors).toContain('Duplikaty etykiet łóżek w ramach jednego pokoju.')
    })
  })

  describe('parseFacilityVoiceJson', () => {
    it('correctly parses JSON from LLM response including code blocks and think tags', () => {
      const rawLlmOutput = `<think>
Extracted room info from nurse speech
</think>
\`\`\`json
{
  "number": "205B",
  "floor": "2",
  "sector": "Skrzydło Zachodnie",
  "bedLabels": ["A", "B", "C"]
}
\`\`\``

      const parsed = parseFacilityVoiceJson(rawLlmOutput)
      expect(parsed._parseError).toBeUndefined()
      expect(parsed.number).toBe('205B')
      expect(parsed.floor).toBe('2')
      expect(parsed.sector).toBe('Skrzydło Zachodnie')
      expect(parsed.bedLabels).toEqual(['A', 'B', 'C'])
    })

    it('derives bedLabels when bedCount is given as number', () => {
      const raw = '{"number": "104", "floor": "Parter", "bedCount": 3}'
      const parsed = parseFacilityVoiceJson(raw)
      expect(parsed._parseError).toBeUndefined()
      expect(parsed.number).toBe('104')
      expect(parsed.floor).toBe('Parter')
      expect(parsed.bedLabels).toEqual(['1', '2', '3'])
    })

    it('returns _parseError: true on corrupt or non-JSON output', () => {
      const raw = 'Nie udało się ustalić pokoju.'
      const parsed = parseFacilityVoiceJson(raw)
      expect(parsed._parseError).toBe(true)
    })
  })
})
