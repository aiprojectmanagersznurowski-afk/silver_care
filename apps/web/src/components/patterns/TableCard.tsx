import type { ReactNode } from 'react'

import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { ListEmpty, ListError, ListLoading } from './ListState'

/**
 * Wspólna ramka tabeli (ADR-017): ten sam promień, obramowanie i tło na każdym ekranie.
 * className służy wyłącznie układowi (np. `hidden sm:block`, `max-h-64 overflow-y-auto`).
 */
export function TableCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-slot="table-card" className={cn('overflow-hidden rounded-xl border border-border bg-card', className)}>
      {children}
    </div>
  )
}

interface TableStateRowProps {
  colSpan: number
  state: 'loading' | 'empty' | 'error'
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
}

/** Stan listy wewnątrz tabeli, rozciągnięty na wszystkie kolumny. */
export function TableStateRow({ colSpan, state, title, description, icon, action }: TableStateRowProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0 whitespace-normal">
        {state === 'loading' && <ListLoading />}
        {state === 'empty' && (
          <ListEmpty framed={false} title={title ?? 'Brak danych'} description={description} icon={icon} action={action} />
        )}
        {state === 'error' && <ListError title={title} description={description} action={action} />}
      </TableCell>
    </TableRow>
  )
}
