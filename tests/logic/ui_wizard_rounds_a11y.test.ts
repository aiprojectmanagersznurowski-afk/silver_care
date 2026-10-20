import { describe, it, expect } from 'vitest'
import { validateDailyLogData } from '../../apps/web/src/lib/daily-logs-schema'
import { suggestBeds, type BedCandidate } from '../../apps/web/src/lib/admission-helpers'

/**
 * @REQ: NUR-BOARD
 * @REQ: ADM-RESIDENT-ADD
 * @REQ: UI-ACCESSIBILITY
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Testy logiki szybkiego obchodu, walidacji wpisów w brudnopisie oraz dostępności kreatora przyjęć.
 */
describe('UI Wizard, Quick Rounds & Accessibility Fixes (UI-WIZARD-ROUNDS-A11Y-FIX)', () => {
  it('waliduje poprawność schematu daily_logs dla rutynowej obserwacji @REQ: NUR-BOARD', () => {
    const sampleRoundPayload = {
      action: 'ROUTINE_OBSERVATION',
      note: 'Stan stabilny, podopieczny spokojny, bez uwag.',
      behavioral_items: ['Stan stabilny, podopieczny spokojny, bez uwag.'],
      source: 'quick_rounds_1click',
      recorded_at: new Date().toISOString(),
    }
    const valResult = validateDailyLogData(sampleRoundPayload)
    expect(valResult.valid).toBe(true)
    expect(valResult.sanitized?.action).toBe('ROUTINE_OBSERVATION')
    expect(valResult.sanitized?.behavioral_items).toHaveLength(1)
  })

  it('odrzuca nieprawidłowe formaty danych w brudnopisie personelu @REQ: NUR-BOARD', () => {
    // 1. Wartość niebędąca obiektem
    const primitiveResult = validateDailyLogData('zwykły tekst')
    expect(primitiveResult.valid).toBe(false)
    expect(primitiveResult.error).toContain('poprawnym obiektem JSON')

    // 2. Tablica zamiast obiektu
    const arrayResult = validateDailyLogData(['wpis 1', 'wpis 2'])
    expect(arrayResult.valid).toBe(false)

    // 3. medical_items niebędące tablicą
    const invalidMedical = validateDailyLogData({ medical_items: 'leki podane' })
    expect(invalidMedical.valid).toBe(false)
    expect(invalidMedical.error).toContain('medical_items musi być tablicą')

    // 4. behavioral_items niebędące tablicą
    const invalidBehavioral = validateDailyLogData({ behavioral_items: 12345 })
    expect(invalidBehavioral.valid).toBe(false)
    expect(invalidBehavioral.error).toContain('behavioral_items musi być tablicą')
  })

  it('generuje dostępne i kompletne sugestie łóżek dla kreatora przyjęcia @REQ: ADM-RESIDENT-ADD', () => {
    const candidates: BedCandidate[] = [
      {
        bedId: 'bed-101-1',
        bedNumber: '1',
        roomId: 'room-101',
        roomNumber: '101',
        floorNumber: 0,
        capacity: 2,
        currentOccupants: [],
      },
    ]

    const suggestions = suggestBeds(candidates, { gender: 'F', careLevel: 'sitting' })
    expect(suggestions).toHaveLength(1)

    const sug = suggestions[0]
    expect(sug.bedId).toBe('bed-101-1')
    expect(sug.bedNumber).toBe('1')
    expect(sug.roomNumber).toBe('101')
    expect(typeof sug.score).toBe('number')
    expect(sug.reason.length).toBeGreaterThan(0)
  })

  it('zapewnia poprawne formatowanie wielostopniowych wpisów z danymi behawioralnymi @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const complexLog = {
      action: 'EVENING_ROUND',
      note: 'Podopieczny przygotowany do snu.',
      behavioral_items: ['Spokojny wieczór', 'Obejrzał program telewizyjny'],
      discomfort_items: [],
      medical_items: [],
      processed_at: new Date().toISOString(),
    }

    const res = validateDailyLogData(complexLog)
    expect(res.valid).toBe(true)
    expect(res.sanitized?.behavioral_items).toEqual(['Spokojny wieczór', 'Obejrzał program telewizyjny'])
  })
})
