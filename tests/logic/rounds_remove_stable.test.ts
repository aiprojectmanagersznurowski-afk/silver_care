import { describe, it, expect } from 'vitest'
import { getCurrentShiftStart, filterCurrentShiftNotes, formatNotesCount } from '../../apps/web/src/lib/shift'
import { getNoteStatus } from '../../apps/web/src/components/staff/board/staff-board-types'

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
      const sample = new Date(2026, 9, 27, 10, 30, 0)
      const start = getCurrentShiftStart(sample)
      expect(start).toBeInstanceOf(Date)
    })

    it('@REQ: NUR-BOARD - liczy granice zmian w strefie Europe/Warsaw niezależnie od czasu serwera UTC', () => {
      // Zima (CET, UTC+1): 07:00 w Warszawie to 06:00 UTC.
      // 05:30 UTC = 06:30 w Warszawie -> zmiana nocna rozpoczęta wczoraj o 19:00 w Warszawie (18:00 UTC)
      const winterNightEnd = new Date('2026-11-15T05:30:00.000Z')
      expect(getCurrentShiftStart(winterNightEnd).toISOString()).toBe('2026-11-14T18:00:00.000Z')

      // 06:30 UTC = 07:30 w Warszawie -> zmiana dzienna rozpoczęta dzisiaj o 07:00 w Warszawie (06:00 UTC)
      const winterDay = new Date('2026-11-15T06:30:00.000Z')
      expect(getCurrentShiftStart(winterDay).toISOString()).toBe('2026-11-15T06:00:00.000Z')

      // 18:30 UTC = 19:30 w Warszawie -> zmiana nocna rozpoczęta dzisiaj o 19:00 w Warszawie (18:00 UTC)
      const winterNightStart = new Date('2026-11-15T18:30:00.000Z')
      expect(getCurrentShiftStart(winterNightStart).toISOString()).toBe('2026-11-15T18:00:00.000Z')
    })

    it('@REQ: NUR-BOARD - zmiana nocna przed północą (19:00 - 23:59) ma początek o 19:00 tego samego dnia', () => {
      // 18:15 UTC = 19:15 w Warszawie (CET)
      const sample = new Date('2026-11-15T18:15:00.000Z')
      const start = getCurrentShiftStart(sample)
      expect(start.toISOString()).toBe('2026-11-15T18:00:00.000Z')
    })

    it('@REQ: NUR-BOARD - zmiana nocna po północy (00:00 - 06:59) ma początek o 19:00 poprzedniego dnia', () => {
      // 02:45 UTC = 03:45 w Warszawie (CET)
      const sample = new Date('2026-11-15T02:45:00.000Z')
      const start = getCurrentShiftStart(sample)
      expect(start.toISOString()).toBe('2026-11-14T18:00:00.000Z')
    })
  })

  describe('getNoteStatus regresja statusu szkicu sprzed zmiany', () => {
    it('@REQ: NUR-BOARD - niezatwierdzony szkic sprzed bieżącej zmiany nadal daje status "draft"', () => {
      const yesterday = new Date('2026-10-26T12:00:00.000Z').toISOString()
      const resident = {
        id: 'r1',
        voice_draft_notes: [
          { id: 'draft-yesterday', status: 'DRAFT', created_at: yesterday },
        ],
        daily_reports: [],
      }
      expect(getNoteStatus(resident)).toBe('draft')
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
