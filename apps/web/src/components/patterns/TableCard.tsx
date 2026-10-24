import type { ReactNode } from 'react'

import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { ListEmpty, ListError, ListLoading } from './ListState'

/**
 * Wspólna ramka tabeli (ADR-017): ten sam promień, obramowanie i tło na każdym ekranie.
 * className służy wyłącznie układowi (np. `hidden sm:block`, `max-h-64 overflow-y-auto`).
 */
interface TableCardProps {
  children: ReactNode
  className?: string
  title?: ReactNode
  description?: ReactNode
  /** Ikona w neutralnym kaflu — ta sama na każdym ekranie, bez koloru marki. */
  icon?: ReactNode
  actions?: ReactNode
  /** Pasek wyszukiwania i filtrów w nagłówku karty, nad tabelą (układ listy szablonu). */
  toolbar?: ReactNode
}

export function TableCard({ children, className, title, description, icon, actions, toolbar }: TableCardProps) {
  return (
    <div data-slot="table-card" className={cn('overflow-hidden rounded-xl border border-border bg-card', className)}>
      {title && (
        <div
          data-slot="table-card-header"
          className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            {icon && (
              <div
                data-slot="table-card-icon"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground [&>svg]:size-5"
              >
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {toolbar && (
        <div data-slot="table-card-toolbar" className="border-b border-border px-4 py-3">
          {toolbar}
        </div>
      )}
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
