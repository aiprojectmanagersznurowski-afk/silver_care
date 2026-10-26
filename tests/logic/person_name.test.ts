import { describe, it, expect } from 'vitest'
import { formatPersonName } from '../../apps/web/src/lib/person-name'

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
})
