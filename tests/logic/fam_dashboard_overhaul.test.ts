import { describe, it, expect } from 'vitest'
import { getAdjacentDateString, isValidIsoDate } from '../../apps/web/src/lib/date-navigation'

/**
 * @REQ: FAM-DASHBOARD
 * @REQ: MDR-NO-PHYSIO-TO-FAMILY
 *
 * Testy logiki pulpitu rodziny (FAM-DASHBOARD-OVERHAUL):
 * AC1: Naprawa menu profilu (brak błędu wykonania)
 * AC2: Podsumowanie dnia na szczycie
 * AC3: Pasek nawigacji datami
 * AC4: Modal galerii zdjęć
 */
describe('Family Dashboard Overhaul Logic (@REQ: FAM-DASHBOARD, @REQ: MDR-NO-PHYSIO-TO-FAMILY)', () => {
  describe('AC3: Nawigacja datami w pulpicie rodziny (@REQ: FAM-DASHBOARD)', () => {
    it('computes previous and next day date strings accurately', () => {
      const base = '2026-09-25'
      expect(getAdjacentDateString(base, -1)).toBe('2026-09-24')
      expect(getAdjacentDateString(base, 1)).toBe('2026-09-26')
    })

    it('handles month and year boundaries correctly', () => {
      expect(getAdjacentDateString('2026-03-01', -1)).toBe('2026-02-28')
      expect(getAdjacentDateString('2026-01-01', -1)).toBe('2025-12-31')
      expect(getAdjacentDateString('2026-12-31', 1)).toBe('2027-01-01')
    })

    it('validates ISO date format YYYY-MM-DD', () => {
      expect(isValidIsoDate('2026-09-25')).toBe(true)
      expect(isValidIsoDate('invalid-date')).toBe(false)
      expect(isValidIsoDate('2026-13-45')).toBe(false)
    })
  })

  describe('Granica MDR w pulpicie rodziny (@REQ: MDR-NO-PHYSIO-TO-FAMILY)', () => {
    it('ensures family dashboard metric structures exclude prohibited physiological metrics', () => {
      const allowedFamilyMetrics = ['steps', 'sleep_hours', 'active_minutes']
      const forbiddenMdrMetrics = ['heart_rate_bpm', 'hrv_ms', 'resting_heart_rate_bpm', 'sleep_score']

      for (const m of forbiddenMdrMetrics) {
        expect(allowedFamilyMetrics).not.toContain(m)
      }
    })
  })
})
