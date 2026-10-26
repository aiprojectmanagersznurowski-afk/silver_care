/**
 * Sortowanie tabel kliknięciem w nagłówek (decyzja Michała 2026-10-26).
 * Polski alfabet, numery jak liczby („9” przed „10”), daty chronologicznie, puste wartości zawsze na końcu.
 */
export type SortDirection = 'asc' | 'desc'
export interface SortState<K extends string = string> {
  key: K
  direction: SortDirection
}
export type SortValue = string | number | boolean | Date | null | undefined

const collator = new Intl.Collator('pl', { sensitivity: 'base', numeric: true })

function isEmpty(v: SortValue): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (v instanceof Date && Number.isNaN(v.getTime()))
}

function compareValues(a: SortValue, b: SortValue): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return collator.compare(String(a), String(b))
}

/** Nowa tablica ułożona według wartości z `accessor`; wejście bez zmian. */
export function sortRows<T>(rows: readonly T[], accessor: (row: T) => SortValue, direction: SortDirection): T[] {
  const sign = direction === 'asc' ? 1 : -1
  return [...rows].sort((ra, rb) => {
    const a = accessor(ra)
    const b = accessor(rb)
    const ea = isEmpty(a)
    const eb = isEmpty(b)
    if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1
    return sign * compareValues(a, b)
  })
}

/** Kliknięcie w nagłówek: ta sama kolumna zmienia kierunek, nowa zaczyna rosnąco. */
export function nextSort<K extends string>(current: SortState<K> | null, key: K): SortState<K> {
  if (current?.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  return { key, direction: 'asc' }
}

export function ariaSort(current: SortState | null, key: string): 'ascending' | 'descending' | 'none' {
  if (current?.key !== key) return 'none'
  return current.direction === 'asc' ? 'ascending' : 'descending'
}
