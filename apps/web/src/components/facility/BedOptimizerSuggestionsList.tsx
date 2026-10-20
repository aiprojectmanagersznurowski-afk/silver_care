'use client'

import React from 'react'
import { Check, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RelocationSuggestion } from '@/lib/bed-allocation-optimizer'

interface BedOptimizerSuggestionsListProps {
  suggestions: RelocationSuggestion[]
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
  handleSelectAll: (checked: boolean) => void
  handleExecuteRelocations: () => void
  isExecuting: boolean
}

export function BedOptimizerSuggestionsList({
  suggestions,
  selectedIds,
  toggleSelect,
  handleSelectAll,
  handleExecuteRelocations,
  isExecuting,
}: BedOptimizerSuggestionsListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          Rekomendowane przeniesienia ({suggestions.length})
        </h4>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={selectedIds.size === suggestions.length && suggestions.length > 0}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary"
          />
          <span>Zaznacz wszystkie</span>
        </label>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {suggestions.map((s) => (
          <div
            key={s.id}
            onClick={() => toggleSelect(s.id)}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              selectedIds.has(s.id)
                ? 'bg-muted border-border'
                : 'bg-card border-border opacity-70 hover:opacity-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedIds.has(s.id)}
                onChange={() => {}}
                className="mt-1 rounded border-border text-primary focus:ring-primary"
              />

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground tracking-wide font-mono">
                    Pensjonariusz {s.residentPseudonym} ({s.gender === 'F' ? 'K' : 'M'})
                  </span>
                  <span className="text-sm uppercase font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground">
                    Priorytet: {s.priority === 'high' ? 'Wysoki' : 'Średni'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-foreground">
                  <span className="bg-muted px-2 py-0.5 rounded-md font-medium">
                    Pokój {s.fromRoomNumber} (P.{s.fromFloor}), Łóżko {s.fromBedLabel}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="bg-muted text-foreground border border-border px-2 py-0.5 rounded-md font-medium">
                    Pokój {s.toRoomNumber} (P.{s.toFloor}), Łóżko {s.toBedLabel}
                  </span>
                </div>

                <p className="text-sm text-foreground pt-0.5">{s.reason}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Wybrano: {selectedIds.size} z {suggestions.length} propozycji
        </p>
        <Button
          onClick={handleExecuteRelocations}
          disabled={isExecuting || selectedIds.size === 0}
          className="bg-primary hover:bg-primary/90 text-white gap-2 text-sm"
        >
          {isExecuting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Zastosuj wybrane przeniesienia ({selectedIds.size})
        </Button>
      </div>
    </div>
  )
}
