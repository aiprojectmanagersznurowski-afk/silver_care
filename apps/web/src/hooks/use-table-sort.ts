'use client'

import { useMemo, useState } from 'react'
import { nextSort, sortRows, type SortState, type SortValue } from '@/lib/table-sort'

/**
 * Stan sortowania tabeli. `accessors` mapuje klucz kolumny na wartość do porównania.
 * Bez aktywnej kolumny wiersze zostają w kolejności wejściowej.
 */
export function useTableSort<T, K extends string>(
  rows: readonly T[],
  accessors: Record<K, (row: T) => SortValue>,
  initial: SortState<K> | null = null
) {
  const [sort, setSort] = useState<SortState<K> | null>(initial)

  const sorted = useMemo(
    () => (sort ? sortRows(rows, accessors[sort.key], sort.direction) : [...rows]),
    // accessors to stała mapa kolumn danej tabeli
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, sort]
  )

  return { sorted, sort, toggleSort: (key: K) => setSort((s) => nextSort(s, key)) }
}
