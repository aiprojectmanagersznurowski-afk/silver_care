import { describe, it, expect } from 'vitest'
import { formatPersonName, matchesPersonName, compareByPersonName, sortByPersonName } from '../../apps/web/src/lib/person-name'

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Imię i nazwisko podopiecznego pokazujemy jako „Nazwisko Imię” (decyzja Michała 2026-10-26).
 * Brak danych to jawne „Brak danych”, nie wymyślona wartość.
 */
describe('Format „Nazwisko Imię” (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - nazwisko przed imieniem, bez zbędnych spacji', () => {
    expect(formatPersonName('Jan', 'Kowalski')).toBe('Kowalski Jan')
    expect(formatPersonName('  Anna ', ' Nowak-Zielińska ')).toBe('Nowak-Zielińska Anna')
    expect(formatPersonName('Jan', null)).toBe('Jan')
    expect(formatPersonName(undefined, 'Kowalski')).toBe('Kowalski')
    expect(formatPersonName('', '')).toBe('Brak danych')
    expect(formatPersonName(null, undefined)).toBe('Brak danych')
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - wyszukiwanie znajduje osobę niezależnie od kolejności imienia i nazwiska', () => {
    expect(matchesPersonName('Jan', 'Kowalski', 'kowalski jan')).toBe(true)
    expect(matchesPersonName('Jan', 'Kowalski', 'Jan Kowalski')).toBe(true)
    expect(matchesPersonName('Jan', 'Kowalski', ' kowal ')).toBe(true)
    expect(matchesPersonName('Jan', 'Kowalski', '')).toBe(true)
    expect(matchesPersonName('Jan', 'Kowalski', 'nowak')).toBe(false)
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - domyślna kolejność: nazwisko, potem imię, z polskim alfabetem', () => {
    const people = [
      { first_name: 'Adam', last_name: 'Żak' },
      { first_name: 'Jan', last_name: 'Adamski' },
      { first_name: 'Ewa', last_name: 'Łuczak' },
      { first_name: 'Anna', last_name: 'Lis' },
      { first_name: 'Adam', last_name: 'Lis' },
    ]
    expect(sortByPersonName(people).map((p) => formatPersonName(p.first_name, p.last_name))).toEqual([
      'Adamski Jan', 'Lis Adam', 'Lis Anna', 'Łuczak Ewa', 'Żak Adam',
    ])
    expect(people[0].last_name).toBe('Żak')
    expect(compareByPersonName({ first_name: 'A', last_name: 'B' }, { first_name: 'A', last_name: 'B' })).toBe(0)
  })
})
