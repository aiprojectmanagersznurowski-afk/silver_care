import { describe, it, expect } from 'vitest'
import { AGENDA_FAMILY_EXCLUSION } from '@silvercare/contracts/src/generated/presentation'
import { isMedicalAgendaItem, AGENDA_MEDICAL_PATTERN } from '../../apps/web/src/lib/agenda-family-visibility'
import { getCategory } from '../../apps/web/src/components/AgendaTimelineClient'

/**
 * @REQ: FAM-AGENDA-NO-MEDICAL
 *
 * Plan dnia rodziny bez treści medycznych (decyzja Michała 2026-10-26). Ta sama reguła co w bazie
 * (agenda_items.family_visible) — słowa pochodzą z kontraktu AGENDA_FAMILY_EXCLUSION.
 */
describe('Pozycje planu dnia ukrywane przed rodziną (@REQ: FAM-AGENDA-NO-MEDICAL)', () => {
  it('@REQ: FAM-AGENDA-NO-MEDICAL - treść medyczna i typ medication są rozpoznawane', () => {
    for (const title of ['Podanie leków 8:00', 'Pomiar ciśnienia', 'RTG klatki piersiowej', 'Zastrzyk insuliny', 'Wizyta lekarska', 'Zabieg rehabilitacyjny', 'Pobranie krwi']) {
      expect(isMedicalAgendaItem({ title, type: 'other' }), title).toBe(true)
    }
    expect(isMedicalAgendaItem({ title: 'Poranek', type: 'medication' })).toBe(true)
    expect(isMedicalAgendaItem({ title: 'Poranek', type: 'MEDICATION' })).toBe(true)
  })

  it('@REQ: FAM-AGENDA-NO-MEDICAL - pozycje niemedyczne o podobnym brzmieniu zostają', () => {
    for (const title of ['Wizyta wnuczki', 'Lekcja tańca', 'Obiad', 'Spacer w ogrodzie', 'Zajęcia plastyczne', 'Drzemka']) {
      expect(isMedicalAgendaItem({ title, type: 'activity' }), title).toBe(false)
    }
  })

  it('@REQ: FAM-AGENDA-NO-MEDICAL - każde słowo z kontraktu jest rozpoznawane na początku słowa', () => {
    for (const terms of Object.values(AGENDA_FAMILY_EXCLUSION.termsByCategory)) {
      for (const term of terms) {
        expect(isMedicalAgendaItem({ title: `Plan: ${term}xyz`, type: 'other' }), term).toBe(true)
        expect(isMedicalAgendaItem({ title: `abc${term}`, type: 'other' }), `${term} w środku słowa`).toBe(false)
      }
    }
    expect(AGENDA_MEDICAL_PATTERN).toContain('ciśnieni')
  })

  it('@REQ: FAM-AGENDA-NO-MEDICAL - widok rodziny nie ma kategorii leków', () => {
    expect(getCategory('Podanie leków', 'medication')).not.toBe('medication')
    expect(getCategory('Wizyta wnuczki')).not.toBe('medication')
    expect(getCategory('Zastrzyk')).not.toBe('medication')
  })
})
