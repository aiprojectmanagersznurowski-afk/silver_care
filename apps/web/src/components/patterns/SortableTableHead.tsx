'use client'

import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import { ariaSort, type SortState } from '@/lib/table-sort'
import { cn } from '@/lib/utils'

interface SortableTableHeadProps<K extends string> {
  sortKey: K
  sort: SortState<K> | null
  onSort: (key: K) => void
  children: ReactNode
  className?: string
}

/** Nagłówek kolumny z przyciskiem sortowania; kierunek ogłaszany przez aria-sort. */
export function SortableTableHead<K extends string>({ sortKey, sort, onSort, children, className }: SortableTableHeadProps<K>) {
  const state = ariaSort(sort, sortKey)
  const Icon = state === 'ascending' ? ArrowUp : state === 'descending' ? ArrowDown : ArrowUpDown
  return (
    <TableHead aria-sort={state} className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          '-mx-2 inline-flex min-h-touch items-center gap-1 rounded-md px-2 font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          state !== 'none' && 'text-foreground'
        )}
      >
        {children}
        <Icon aria-hidden="true" className={cn('size-4', state === 'none' && 'opacity-50')} />
      </button>
    </TableHead>
  )
}
