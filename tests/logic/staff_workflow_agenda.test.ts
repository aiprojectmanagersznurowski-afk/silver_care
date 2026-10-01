import { describe, it, expect } from 'vitest'

/**
 * @REQ: NUR-BOARD
 * @REQ: NUR-AGENDA
 *
 * Testy jednostkowe dla przepływu pracy personelu i agendy (NUR-STAFF-WORKFLOW-AGENDA):
 * - Logika filtrowania tokenowego pensjonariuszy (NUR-BOARD)
 * - Podział na pory dnia i wyznaczanie aktywnej pory (NUR-AGENDA)
 * - Reguły walidacji wpisów agendy, przypisywanie do pensjonariusza vs całej placówki (NUR-AGENDA)
 * - Zgodność z MDR: zakaz słowa 'pacjent' oraz terminologii diagnostycznej
 */

// Helpery logiki do przetestowania i wdrożenia
export type TimeOfDaySlot = 'morning' | 'noon' | 'afternoon' | 'evening'

export interface TimeSlotConfig {
  slot: TimeOfDaySlot
  label: string
  timeRange: string
  startHour: number
  endHour: number
}

export const TIME_OF_DAY_SLOTS: TimeSlotConfig[] = [
  { slot: 'morning', label: 'Rano', timeRange: '06:00 – 11:59', startHour: 6, endHour: 11 },
  { slot: 'noon', label: 'Południe', timeRange: '12:00 – 14:59', startHour: 12, endHour: 14 },
  { slot: 'afternoon', label: 'Popołudnie', timeRange: '15:00 – 17:59', startHour: 15, endHour: 17 },
  { slot: 'evening', label: 'Wieczór i noc', timeRange: '18:00 – 05:59', startHour: 18, endHour: 23 },
]

export function getTimeOfDaySlot(timeStr: string): TimeOfDaySlot {
  const [hourStr] = timeStr.split(':')
  const hour = parseInt(hourStr, 10)
  if (isNaN(hour)) return 'morning'

  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 15) return 'noon'
  if (hour >= 15 && hour < 18) return 'afternoon'
  return 'evening'
}

export function getCurrentTimeSlot(currentHour: number): TimeOfDaySlot {
  if (currentHour >= 6 && currentHour < 12) return 'morning'
  if (currentHour >= 12 && currentHour < 15) return 'noon'
  if (currentHour >= 15 && currentHour < 18) return 'afternoon'
  return 'evening'
}

export interface AgendaItemPayload {
  title: string
  time: string
  type: string
  resident_id?: string | null
}

const FORBIDDEN_MDR_TERMS = ['pacjent', 'diagnoza', 'zawał', 'udar', 'omdlenie', 'hipotermia']

export function validateAgendaItem(item: AgendaItemPayload): { isValid: boolean; error?: string } {
  if (!item.title?.trim()) {
    return { isValid: false, error: 'Tytuł jest wymagany' }
  }
  if (!item.time || !/^\d{2}:\d{2}(:\d{2})?$/.test(item.time)) {
    return { isValid: false, error: 'Nieprawidłowy format godziny' }
  }
  if (!item.type?.trim()) {
    return { isValid: false, error: 'Typ jest wymagany' }
  }

  const lowerTitle = item.title.toLowerCase()
  for (const term of FORBIDDEN_MDR_TERMS) {
    if (lowerTitle.includes(term)) {
      return { 
        isValid: false, 
        error: `Wpis narusza zasady klasyfikacji niemedycznej (niedozwolony termin: '${term}'). Użyj języka opiekuńczego i neutralnego.` 
      }
    }
  }

  return { isValid: true }
}

export interface FilterToken {
  type: 'floor' | 'room' | 'status' | 'search'
  value: string
  label: string
}

export function filterResidentsWithTokens(
  residents: Array<{
    id: string
    first_name: string
    last_name: string
    floor?: string | null
    room?: string | null
    noteStatus?: 'ready' | 'draft' | 'none'
  }>,
  filters: {
    floor: string
    room: string
    status: string
    search: string
  }
) {
  return residents.filter((r) => {
    const fullName = `${r.first_name} ${r.last_name}`.toLowerCase()
    if (filters.search && !fullName.includes(filters.search.toLowerCase().trim())) {
      return false
    }
    if (filters.floor !== 'all' && r.floor !== filters.floor) {
      return false
    }
    if (filters.room !== 'all' && r.room !== filters.room) {
      return false
    }
    if (filters.status !== 'all' && r.noteStatus !== filters.status) {
      return false
    }
    return true
  })
}

describe('Staff Workflow & Agenda Logic (@REQ: NUR-BOARD, @REQ: NUR-AGENDA)', () => {
  it('categorizes daily agenda items into proper time-of-day slots @REQ: NUR-AGENDA', () => {
    expect(getTimeOfDaySlot('07:30')).toBe('morning')
    expect(getTimeOfDaySlot('09:00')).toBe('morning')
    expect(getTimeOfDaySlot('12:15')).toBe('noon')
    expect(getTimeOfDaySlot('14:30')).toBe('noon')
    expect(getTimeOfDaySlot('15:00')).toBe('afternoon')
    expect(getTimeOfDaySlot('17:45')).toBe('afternoon')
    expect(getTimeOfDaySlot('18:00')).toBe('evening')
    expect(getTimeOfDaySlot('21:00')).toBe('evening')
    expect(getTimeOfDaySlot('02:00')).toBe('evening') // noc
  })

  it('detects current active time slot based on hour @REQ: NUR-AGENDA', () => {
    expect(getCurrentTimeSlot(8)).toBe('morning')
    expect(getCurrentTimeSlot(13)).toBe('noon')
    expect(getCurrentTimeSlot(16)).toBe('afternoon')
    expect(getCurrentTimeSlot(20)).toBe('evening')
  })

  it('validates agenda item payload and blocks medical/clinical terms @REQ: NUR-AGENDA', () => {
    // Prawidłowy wpis ogólny
    const validGeneral = validateAgendaItem({
      title: 'Śniadanie i poranna toaleta',
      time: '08:30',
      type: 'meal',
      resident_id: null,
    })
    expect(validGeneral.isValid).toBe(true)

    // Prawidłowy wpis dedykowany podopiecznemu
    const validSpecific = validateAgendaItem({
      title: 'Spacer w ogrodzie z opiekunem',
      time: '15:30',
      type: 'activity',
      resident_id: '11111111-1111-1111-1111-111111111111',
    })
    expect(validSpecific.isValid).toBe(true)

    // Naruszenie: termin medyczny / zakazane słowo 'pacjent'
    const invalidPatient = validateAgendaItem({
      title: 'Podanie leków dla nowego pacjenta',
      time: '09:00',
      type: 'therapy',
    })
    expect(invalidPatient.isValid).toBe(false)
    expect(invalidPatient.error).toContain('pacjent')

    // Naruszenie: diagnoza kliniczna
    const invalidDiagnosis = validateAgendaItem({
      title: 'Kontrola powikłań - zawał serca',
      time: '10:00',
      type: 'therapy',
    })
    expect(invalidDiagnosis.isValid).toBe(false)
    expect(invalidDiagnosis.error).toContain('zawał')
  })

  it('filters residents correctly with floor, room, status and search tokens @REQ: NUR-BOARD', () => {
    const sampleResidents = [
      { id: '1', first_name: 'Jan', last_name: 'Kowalski', floor: '1', room: '101', noteStatus: 'ready' as const },
      { id: '2', first_name: 'Anna', last_name: 'Nowak', floor: '1', room: '102', noteStatus: 'none' as const },
      { id: '3', first_name: 'Piotr', last_name: 'Zieliński', floor: '2', room: '201', noteStatus: 'draft' as const },
      { id: '4', first_name: 'Maria', last_name: 'Wiśniewska', floor: '2', room: '202', noteStatus: 'none' as const },
    ]

    // Wszystkie
    const all = filterResidentsWithTokens(sampleResidents, { floor: 'all', room: 'all', status: 'all', search: '' })
    expect(all).toHaveLength(4)

    // Filtrowanie po piętrze
    const floor1 = filterResidentsWithTokens(sampleResidents, { floor: '1', room: 'all', status: 'all', search: '' })
    expect(floor1).toHaveLength(2)
    expect(floor1.map(r => r.id)).toEqual(['1', '2'])

    // Filtrowanie po statusie 'none' (brak wpisu)
    const missingNote = filterResidentsWithTokens(sampleResidents, { floor: 'all', room: 'all', status: 'none', search: '' })
    expect(missingNote).toHaveLength(2)
    expect(missingNote.map(r => r.id)).toEqual(['2', '4'])

    // Filtrowanie po pokoju
    const room201 = filterResidentsWithTokens(sampleResidents, { floor: '2', room: '201', status: 'all', search: '' })
    expect(room201).toHaveLength(1)
    expect(room201[0].last_name).toBe('Zieliński')

    // Wyszukiwanie frazą
    const searched = filterResidentsWithTokens(sampleResidents, { floor: 'all', room: 'all', status: 'all', search: 'Nowak' })
    expect(searched).toHaveLength(1)
    expect(searched[0].first_name).toBe('Anna')
  })
})
