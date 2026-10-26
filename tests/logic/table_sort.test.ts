import { describe, it, expect } from 'vitest'
import { sortRows, nextSort, ariaSort, type SortState } from '../../apps/web/src/lib/table-sort'

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Tabele można sortować kliknięciem w nagłówek kolumny (decyzja Michała 2026-10-26).
 * Polski alfabet, liczby jako liczby (pokój 9 przed 10), daty chronologicznie, puste wartości zawsze na końcu.
 */
type Row = { name: string | null; room: string | null; at: string | null }
const rows: Row[] = [
  { name: 'Żak Adam', room: '10', at: '2026-01-05' },
  { name: 'Łuczak Ewa', room: '9', at: null },
  { name: null, room: '101', at: '2025-12-31' },
  { name: 'Adamski Jan', room: null, at: '2026-03-01' },
]

describe('Sortowanie tabel (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - tekst po polsku, puste na końcu w obu kierunkach', () => {
    expect(sortRows(rows, (r) => r.name, 'asc').map((r) => r.name)).toEqual(['Adamski Jan', 'Łuczak Ewa', 'Żak Adam', null])
    expect(sortRows(rows, (r) => r.name, 'desc').map((r) => r.name)).toEqual(['Żak Adam', 'Łuczak Ewa', 'Adamski Jan', null])
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - numery pokoi jako liczby, daty chronologicznie', () => {
    expect(sortRows(rows, (r) => r.room, 'asc').map((r) => r.room)).toEqual(['9', '10', '101', null])
    expect(sortRows(rows, (r) => (r.at ? new Date(r.at) : null), 'desc').map((r) => r.at)).toEqual(['2026-03-01', '2026-01-05', '2025-12-31', null])
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - nie zmienia wejścia', () => {
    const copy = [...rows]
    sortRows(rows, (r) => r.name, 'asc')
    expect(rows).toEqual(copy)
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - kliknięcie: nowa kolumna rosnąco, ta sama zmienia kierunek; aria-sort', () => {
    const start: SortState = { key: 'name', direction: 'asc' }
    expect(nextSort(start, 'name')).toEqual({ key: 'name', direction: 'desc' })
    expect(nextSort({ key: 'name', direction: 'desc' }, 'name')).toEqual({ key: 'name', direction: 'asc' })
    expect(nextSort(start, 'room')).toEqual({ key: 'room', direction: 'asc' })
    expect(ariaSort(start, 'name')).toBe('ascending')
    expect(ariaSort({ key: 'name', direction: 'desc' }, 'name')).toBe('descending')
    expect(ariaSort(start, 'room')).toBe('none')
  })
})
