'use client'

import React from 'react'
import { Zap, LayoutGrid, X } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PageHeader } from '@/components/patterns/PageHeader'

interface StaffBoardHeaderProps {
  viewMode: 'rounds' | 'standard'
  onViewModeChange: (mode: 'rounds' | 'standard') => void
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
        <ToggleGroup
          variant="outline"
          aria-label="Tryb widoku podopiecznych"
          value={[viewMode]}
          onValueChange={(next) => {
            const mode = next[0]
            if (mode === 'rounds' || mode === 'standard') onViewModeChange(mode)
          }}
        >
          <ToggleGroupItem
            value="rounds"
            className="gap-1.5 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground min-h-touch"
          >
            <Zap className="h-4 w-4" />
            <span className="sm:hidden text-sm">Obchód</span>
            <span className="hidden sm:inline text-sm">Szybki obchód (Quick-Rounds)</span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="standard"
            className="gap-1.5 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground min-h-touch"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="text-sm">Karty</span>
          </ToggleGroupItem>
        </ToggleGroup>

        {activeFiltersCount > 0 && (
          <button
            onClick={onClearFilters}
            className="inline-flex items-center gap-1.5 rounded-xl bg-muted/50 px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-touch"
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
