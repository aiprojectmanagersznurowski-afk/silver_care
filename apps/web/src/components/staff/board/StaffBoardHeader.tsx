'use client'

import React from 'react'
import { Zap, LayoutGrid, X } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

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
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 className="text-3xl font-display font-semibold tracking-tight text-foreground">
          Podopieczni
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Szybki obchód dyżurny, bezpośrednie dyktowanie i bieżący stan podopiecznych.
        </p>
      </div>

      <div className="flex items-center gap-2">
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
            className="gap-1.5 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground min-h-11"
          >
            <Zap className="h-4 w-4" />
            <span className="sm:hidden text-sm">Obchód</span>
            <span className="hidden sm:inline text-sm">Szybki obchód (Quick-Rounds)</span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="standard"
            className="gap-1.5 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground min-h-11"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="text-sm">Karty</span>
          </ToggleGroupItem>
        </ToggleGroup>

        {activeFiltersCount > 0 && (
          <button
            onClick={onClearFilters}
            className="inline-flex items-center gap-1.5 rounded-xl bg-muted/50 px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-11"
          >
            Wyczyść ({activeFiltersCount})
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
