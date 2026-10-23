'use client'

import type { ReactNode } from 'react'

import { useViewPreference } from '@/hooks/use-view-preference'
import { TableCard } from './TableCard'
import { ViewToggle, GRID_TABLE_OPTIONS } from './ViewToggle'

interface ListViewFrameProps {
  /** Klucz localStorage zapamiętanego widoku (VIEW_PREFERENCE_KEYS). */
  storageKey: string
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  /** Oba warianty mogą być wyrenderowane na serwerze (np. z formularzem akcji serwera). */
  table: ReactNode
  grid: ReactNode
}

/**
 * Lista w ramce TableCard z przełącznikiem kafelki/tabela w nagłówku (ADR-017).
 * Bez zapamiętanej preferencji pokazuje tabelę.
 */
export function ListViewFrame({ storageKey, title, description, icon, actions, table, grid }: ListViewFrameProps) {
  const [viewMode, setViewMode] = useViewPreference(storageKey, 'table', ['table', 'grid'] as const)
  return (
    <TableCard
      title={title}
      description={description}
      icon={icon}
      actions={
        <>
          <ViewToggle value={viewMode} onChange={setViewMode} options={GRID_TABLE_OPTIONS} />
          {actions}
        </>
      }
    >
      {viewMode === 'grid' ? <div className="p-4">{grid}</div> : table}
    </TableCard>
  )
}
