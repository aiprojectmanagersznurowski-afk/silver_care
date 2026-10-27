import { describe, it, expect } from 'vitest'
import { getCurrentShiftStart, filterCurrentShiftNotes, formatNotesCount } from '../../apps/web/src/lib/shift'

/**
 * @REQ: NUR-BOARD
 *
 * Testy logiki wskaźnika notatek na zmianie personelu (SC-NUR-06 / NUR-BOARD).
 * Wycofanie szablonowych wpisów „Stan stabilny” oraz rzetelne prezentowanie faktów
 * o notatkach z bieżącej zmiany (12h).
 */
describe('Wskaźnik notatek bieżącej zmiany personelu (@REQ: NUR-BOARD)', () => {
  describe('getCurrentShiftStart', () => {
    it('@REQ: NUR-BOARD - zmiana dzienna (07:00 - 19:00) ma początek o 07:00 tego samego dnia', () => {
      const now = new Date('2026-10-27T14:35:00Z')
      // Local time hours depend on env, but we test logic with explicit local hours
      const sample = new Date(2026, 9, 27, 10, 30, 0)
      const start = getCurrentShiftStart(sample)
      expect(start.getFullYear()).toBe(2026)
      expect(start.getMonth()).toBe(9)
      expect(start.getDate()).toBe(27)
      expect(start.getHours()).toBe(7)
      expect(start.getMinutes()).toBe(0)
      expect(start.getSeconds()).toBe(0)
    })

    it('@REQ: NUR-BOARD - zmiana nocna przed północą (19:00 - 23:59) ma początek o 19:00 tego samego dnia', () => {
      const sample = new Date(2026, 9, 27, 21, 15, 0)
      const start = getCurrentShiftStart(sample)
      expect(start.getDate()).toBe(27)
      expect(start.getHours()).toBe(19)
      expect(start.getMinutes()).toBe(0)
    })

    it('@REQ: NUR-BOARD - zmiana nocna po północy (00:00 - 06:59) ma początek o 19:00 poprzedniego dnia', () => {
      const sample = new Date(2026, 9, 28, 3, 45, 0)
      const start = getCurrentShiftStart(sample)
      expect(start.getDate()).toBe(27)
      expect(start.getHours()).toBe(19)
      expect(start.getMinutes()).toBe(0)
    })
  })

  describe('filterCurrentShiftNotes', () => {
    it('@REQ: NUR-BOARD - odrzuca notatki sprzed bieżącej zmiany i zachowuje notatki z trwającej zmiany', () => {
      const shiftStart = new Date(2026, 9, 27, 7, 0, 0)
      const notes = [
        { id: '1', created_at: new Date(2026, 9, 26, 15, 0, 0).toISOString() }, // wczoraj
        { id: '2', created_at: new Date(2026, 9, 27, 6, 50, 0).toISOString() }, // poprzednia noc
        { id: '3', created_at: new Date(2026, 9, 27, 7, 15, 0).toISOString() }, // bieżąca zmiana
        { id: '4', created_at: new Date(2026, 9, 27, 9, 30, 0).toISOString() }, // bieżąca zmiana
      ]

      const current = filterCurrentShiftNotes(notes, shiftStart)
      expect(current.map((n) => n.id)).toEqual(['3', '4'])
    })
  })

  describe('formatNotesCount (polska deklinacja)', () => {
    it('@REQ: NUR-BOARD - poprawna odmiana liczbowa po polsku', () => {
      expect(formatNotesCount(0)).toBe('Brak notatek')
      expect(formatNotesCount(1)).toBe('1 notatka')
      expect(formatNotesCount(2)).toBe('2 notatki')
      expect(formatNotesCount(3)).toBe('3 notatki')
      expect(formatNotesCount(4)).toBe('4 notatki')
      expect(formatNotesCount(5)).toBe('5 notatek')
      expect(formatNotesCount(11)).toBe('11 notatek')
      expect(formatNotesCount(12)).toBe('12 notatek')
      expect(formatNotesCount(14)).toBe('14 notatek')
      expect(formatNotesCount(21)).toBe('21 notatek')
      expect(formatNotesCount(22)).toBe('22 notatki')
      expect(formatNotesCount(23)).toBe('23 notatki')
      expect(formatNotesCount(24)).toBe('24 notatki')
      expect(formatNotesCount(25)).toBe('25 notatek')
    })
  })
})
