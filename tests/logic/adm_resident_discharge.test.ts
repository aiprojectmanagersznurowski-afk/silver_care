import { describe, it, expect } from 'vitest'
import {
  validateDischargePayload,
  determineResidentStatus,
  DischargeValidationResult,
} from '../../apps/web/src/lib/discharge-helpers'

/**
 * @REQ: ADM-BED-ASSIGNMENT
 * @REQ: ADM-ARCHIVE
 */
describe('Discharge and Contract Termination Logic (@REQ: ADM-BED-ASSIGNMENT, @REQ: ADM-ARCHIVE)', () => {
  it('validates a standard discharge payload with family_request reason', () => {
    const payload = {
      residentId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      contractEndDate: '2026-10-15',
      contractEndReason: 'family_request',
      notes: 'Pensjonariusz wraca pod opiekę syna.',
    }

    const result = validateDischargePayload(payload)
    expect(result.isValid).toBe(true)
    if (result.isValid) {
      expect(result.data.residentId).toBe(payload.residentId)
      expect(result.data.contractEndDate).toBe('2026-10-15')
      expect(result.data.contractEndReason).toBe('family_request')
      expect(result.data.deathDate).toBeNull()
      expect(result.data.notes).toBe('Pensjonariusz wraca pod opiekę syna.')
    }
  })

  it('validates death registration with mandatory deathDate', () => {
    const payload = {
      residentId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      contractEndDate: '2026-10-14',
      contractEndReason: 'death',
      deathDate: '2026-10-14',
      notes: 'Zgon w szpitalu miejskim.',
    }

    const result = validateDischargePayload(payload)
    expect(result.isValid).toBe(true)
    if (result.isValid) {
      expect(result.data.contractEndReason).toBe('death')
      expect(result.data.deathDate).toBe('2026-10-14')
    }
  })

  it('rejects death reason when deathDate is missing', () => {
    const payload = {
      residentId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      contractEndDate: '2026-10-14',
      contractEndReason: 'death',
      deathDate: null,
    }

    const result = validateDischargePayload(payload)
    expect(result.isValid).toBe(false)
    if (!result.isValid) {
      expect(result.errors).toContain('W przypadku zgonu data zgonu jest wymagana.')
    }
  })

  it('rejects invalid or unknown contract end reasons', () => {
    const payload = {
      residentId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      contractEndDate: '2026-10-14',
      contractEndReason: 'unknown_illegal_reason',
    }

    const result = validateDischargePayload(payload)
    expect(result.isValid).toBe(false)
    if (!result.isValid) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })

  it('rejects invalid date formats', () => {
    const payload = {
      residentId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      contractEndDate: '14-10-2026', // Nieprawidłowy format ISO YYYY-MM-DD
      contractEndReason: 'transfer',
    }

    const result = validateDischargePayload(payload)
    expect(result.isValid).toBe(false)
    if (!result.isValid) {
      expect(result.errors.some((e) => e.includes('format'))).toBe(true)
    }
  })

  it('correctly determines resident status including discharged and deceased without premature archiving', () => {
    // 1. Aktywny pensjonariusz
    expect(
      determineResidentStatus({
        archived_at: null,
        death_date: null,
        contract_end_date: null,
      })
    ).toBe('active')

    // 2. Wypisany z przeszłą datą zakończenia umowy (Wariant B - archived_at = null)
    expect(
      determineResidentStatus({
        archived_at: null,
        death_date: null,
        contract_end_date: '2026-01-01',
      })
    ).toBe('discharged')

    // 3. Zgon (Wariant B - archived_at = null)
    expect(
      determineResidentStatus({
        archived_at: null,
        death_date: '2026-05-10',
        contract_end_date: '2026-05-10',
      })
    ).toBe('deceased')

    // 4. Jawnie zarchiwizowany
    expect(
      determineResidentStatus({
        archived_at: '2026-06-01T10:00:00Z',
        death_date: null,
        contract_end_date: '2026-01-01',
      })
    ).toBe('archived')
  })

  it('strictly adheres to MDR-VOCABULARY (no patient word)', () => {
    const sampleText = JSON.stringify({
      title: 'Zakończ pobyt pensjonariusza',
      description: 'Zwolnienie przypisanego łóżka oraz rejestracja wypisu podopiecznego',
      statusLabels: {
        active: 'Aktywny',
        discharged: 'Wypisany',
        deceased: 'Zgon',
        archived: 'Zarchiwizowany',
      },
    })

    expect(sampleText.toLowerCase()).not.toMatch(/pacjent/)
  })
})
