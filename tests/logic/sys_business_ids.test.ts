import { describe, it, expect } from 'vitest'
import { formatBusinessId, parseBusinessId, isValidBusinessId } from '../../apps/web/src/lib/business-ids'

/**
 * @REQ: INT-CORE-DECOUPLED
 * @REQ: ADM-FACILITY-MANAGE
 *
 * Testy formatowania identyfikatorów biznesowych (SYS-BUSINESS-IDS):
 * AC1: Krótkie czytelne kody z prefiksami (PLC, PEN, POK, PRAC)
 * AC2: Deterministyczne generowanie z UUID oraz z numerów sekwencyjnych
 * AC3: Niezmienność warstwy danych — walidacja formatu bez naruszania UUID
 */
describe('System Business IDs Presentation Logic (@REQ: INT-CORE-DECOUPLED, @REQ: ADM-FACILITY-MANAGE)', () => {
  const sampleUuid = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d'

  describe('AC1 & AC2: Formatowanie kodów biznesowych z prefiksami', () => {
    it('formats organization business ID with PLC- prefix', () => {
      const fromSeq = formatBusinessId('organization', sampleUuid, 1)
      expect(fromSeq).toBe('PLC-001')

      const fromUuid = formatBusinessId('organization', sampleUuid)
      expect(fromUuid).toMatch(/^PLC-[A-Z0-9]{4}$/)
      expect(isValidBusinessId(fromUuid)).toBe(true)
    })

    it('formats resident business ID with PEN- prefix', () => {
      const fromSeq = formatBusinessId('resident', sampleUuid, 42)
      expect(fromSeq).toBe('PEN-0042')

      const fromUuid = formatBusinessId('resident', sampleUuid)
      expect(fromUuid).toMatch(/^PEN-[A-Z0-9]{4}$/)
      expect(isValidBusinessId(fromUuid)).toBe(true)
    })

    it('formats room business ID with POK- prefix', () => {
      const fromSeq = formatBusinessId('room', sampleUuid, 101)
      expect(fromSeq).toBe('POK-101')

      const fromUuid = formatBusinessId('room', sampleUuid)
      expect(fromUuid).toMatch(/^POK-[A-Z0-9]{4}$/)
      expect(isValidBusinessId(fromUuid)).toBe(true)
    })

    it('formats staff business ID with PRAC- prefix', () => {
      const fromSeq = formatBusinessId('staff', sampleUuid, 7)
      expect(fromSeq).toBe('PRAC-07')

      const fromUuid = formatBusinessId('staff', sampleUuid)
      expect(fromUuid).toMatch(/^PRAC-[A-Z0-9]{4}$/)
      expect(isValidBusinessId(fromUuid)).toBe(true)
    })

    it('generates deterministic codes for the same UUID', () => {
      const code1 = formatBusinessId('organization', sampleUuid)
      const code2 = formatBusinessId('organization', sampleUuid)
      expect(code1).toBe(code2)
    })
  })

  describe('AC3: Parsowanie i walidacja identyfikatorów', () => {
    it('parses valid business IDs into type and code components', () => {
      expect(parseBusinessId('PLC-001')).toEqual({ type: 'organization', code: '001', prefix: 'PLC' })
      expect(parseBusinessId('PEN-0042')).toEqual({ type: 'resident', code: '0042', prefix: 'PEN' })
      expect(parseBusinessId('POK-101')).toEqual({ type: 'room', code: '101', prefix: 'POK' })
      expect(parseBusinessId('PRAC-05')).toEqual({ type: 'staff', code: '05', prefix: 'PRAC' })
    })

    it('returns null for invalid business ID formats', () => {
      expect(parseBusinessId('INVALID-123')).toBeNull()
      expect(parseBusinessId('12345')).toBeNull()
      expect(parseBusinessId('')).toBeNull()
    })
  })
})
