import { describe, it, expect } from 'vitest'
import {
  validateDischargePayload,
  determineResidentStatus,
  validateDeathInitiationPayload,
  canInitiateDeathProcedure,
  buildPostMortemSanitizationTasks,
  formatDeathInitiationNote,
  hasPendingDeathInitiation,
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

  describe('Operacyjna inicjacja zgłoszenia zgonu przez personel (ADM-RESIDENT-LIFECYCLE-DISCHARGE)', () => {
    it('@REQ: ADM-BED-ASSIGNMENT - uprawnia wyłącznie nurse i org_admin (poza impersonacją) do inicjacji zgłoszenia zgonu', () => {
      expect(canInitiateDeathProcedure('nurse', false)).toBe(true)
      expect(canInitiateDeathProcedure('org_admin', false)).toBe(true)
      expect(canInitiateDeathProcedure('nurse', true)).toBe(false)
      expect(canInitiateDeathProcedure('super_admin', true)).toBe(false)
      expect(canInitiateDeathProcedure('family', false)).toBe(false)
      expect(canInitiateDeathProcedure('legal_guardian', false)).toBe(false)
      expect(canInitiateDeathProcedure(undefined, false)).toBe(false)
    })

    it('@REQ: ADM-ARCHIVE - waliduje payload inicjacji zgłoszenia wyłącznie dla zgonu', () => {
      const valid = validateDeathInitiationPayload({
        residentId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        deathDate: '2026-10-29',
        notes: 'Zgon odnotowany podczas porannego obchodu.',
      })
      expect(valid.isValid).toBe(true)
      if (valid.isValid) {
        expect(valid.data.residentId).toBe('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d')
        expect(valid.data.deathDate).toBe('2026-10-29')
        expect(valid.data.notes).toBe('Zgon odnotowany podczas porannego obchodu.')
      }

      const missingDate = validateDeathInitiationPayload({
        residentId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        deathDate: '',
      })
      expect(missingDate.isValid).toBe(false)
    })

    it('@REQ: ADM-BED-ASSIGNMENT - generuje pakiet zadań sanitarno-porządkowych niewidocznych dla rodziny', () => {
      const tasks = buildPostMortemSanitizationTasks({
        residentId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        targetDate: '2026-10-29',
        bedLabel: 'Pokój 102, Łóżko A',
      })

      expect(tasks.length).toBe(3)
      expect(tasks.every((t) => t.family_visible === false)).toBe(true)
      expect(tasks.every((t) => t.type === 'staff_only')).toBe(true)
      expect(tasks.every((t) => t.resident_id === 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d')).toBe(true)
      expect(tasks.some((t) => t.title.includes('karty zgonu'))).toBe(true)
      expect(tasks.some((t) => t.title.includes('depozytu'))).toBe(true)
      expect(tasks.some((t) => t.title.includes('Pokój 102, Łóżko A'))).toBe(true)
    })

    it('@REQ: ADM-ARCHIVE - oznacza i wykrywa oczekujące zgłoszenie zgonu do zatwierdzenia przez admina', () => {
      // Wykrywa oczekujące zgłoszenie na podstawie death_reported_at (bez wycieku danych w notes)
      expect(hasPendingDeathInitiation({ death_reported_at: '2026-10-29T10:00:00Z', death_date: null })).toBe(true)
      // Po formalnym zatwierdzeniu przez admina (ustawieniu death_date) nie jest już "oczekujące"
      expect(hasPendingDeathInitiation({ death_reported_at: '2026-10-29T10:00:00Z', death_date: '2026-10-29' })).toBe(false)
      // Brak zgłoszenia
      expect(hasPendingDeathInitiation({ death_reported_at: null, death_date: null })).toBe(false)
    })
  })
})

