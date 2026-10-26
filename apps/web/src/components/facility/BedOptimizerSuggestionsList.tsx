'use client'

import React from 'react'
import { Check, Loader2 } from 'lucide-react'
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
          <label
            key={s.id}
            data-testid="bed-optimizer-suggestion"
            className={`flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring ${
              selectedIds.has(s.id) ? 'bg-muted' : 'bg-card hover:bg-muted/50'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(s.id)}
              onChange={() => toggleSelect(s.id)}
              className="mt-0.5 size-5 shrink-0 rounded border-border text-primary focus:ring-primary"
            />

            <div className="flex-1 min-w-0 space-y-1">
              <div data-testid="bed-optimizer-route" className="text-sm font-semibold text-foreground">
                Pokój {s.fromRoomNumber}, łóżko {s.fromBedLabel} (piętro {s.fromFloor}) → Pokój {s.toRoomNumber}, łóżko {s.toBedLabel} (piętro {s.toFloor})
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                <span data-testid="bed-optimizer-resident" className="font-medium">{s.residentName}</span>
                <span className="text-muted-foreground">{s.gender === 'F' ? 'kobieta' : 'mężczyzna'}</span>
                <span className="px-2 py-0.5 rounded-full bg-muted text-foreground">
                  Priorytet: {s.priority === 'high' ? 'wysoki' : 'średni'}
                </span>
              </div>
              <p data-testid="bed-optimizer-reason" className="text-sm text-muted-foreground">{s.reason}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Wybrano: {selectedIds.size} z {suggestions.length} propozycji
        </p>
        <Button
          onClick={handleExecuteRelocations}
          disabled={isExecuting || selectedIds.size === 0}
          className="gap-2 text-sm"
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
