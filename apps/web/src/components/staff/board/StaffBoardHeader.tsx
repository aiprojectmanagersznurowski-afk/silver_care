'use client'

import React from 'react'
import { Zap, LayoutGrid, Table as TableIcon, X } from 'lucide-react'
import { PageHeader } from '@/components/patterns/PageHeader'
import { ViewToggle } from '@/components/patterns/ViewToggle'

export type StaffBoardViewMode = 'table' | 'rounds' | 'standard'

/** Tablica dyżuru: tabela (domyślna) oraz dwa widoki kafelkowe — szybki obchód i karty. */
const STAFF_BOARD_OPTIONS = [
  { value: 'table', label: 'Tabela', ariaLabel: 'Widok tabeli', icon: <TableIcon /> },
  { value: 'rounds', label: 'Szybki obchód', ariaLabel: 'Widok szybkiego obchodu', icon: <Zap /> },
  { value: 'standard', label: 'Karty', ariaLabel: 'Widok kafelków', icon: <LayoutGrid /> },
] as const

interface StaffBoardHeaderProps {
  viewMode: StaffBoardViewMode
  onViewModeChange: (mode: StaffBoardViewMode) => void
  activeFiltersCount: number
  onClearFilters: () => void
}

export function StaffBoardHeader({
  viewMode,
  onViewModeChange,
  activeFiltersCount,
  onClearFilters,
}: StaffBoardHeaderProps) {
  return (
    <PageHeader
      title="Podopieczni"
      description="Szybki obchód dyżurny, bezpośrednie dyktowanie i bieżący stan podopiecznych."
      actions={
        <>
          <ViewToggle value={viewMode} onChange={onViewModeChange} options={STAFF_BOARD_OPTIONS} />
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-touch"
            >
              Wyczyść ({activeFiltersCount})
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      }
    />
  )
}
