'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Bed, Check, Loader2 } from 'lucide-react'
import type { BedSuggestion } from './admission-types'

interface AdmissionStepBedProps {
  suggestions: BedSuggestion[]
  selectedBedId: string | null
  setSelectedBedId: (id: string | null) => void
  selectedBedInfo: string | null
  setSelectedBedInfo: (info: string | null) => void
  loadingSuggestions: boolean
  onFetchSuggestions: () => void
}

export function AdmissionStepBed({
  suggestions,
  selectedBedId,
  setSelectedBedId,
  selectedBedInfo,
  setSelectedBedInfo,
  loadingSuggestions,
  onFetchSuggestions,
}: AdmissionStepBedProps) {
  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Rekomendowane łóżka</h4>
          <p className="text-sm text-muted-foreground">Dopasowane według kryteriów płci w pokoju oraz piętra.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onFetchSuggestions}
          disabled={loadingSuggestions}
          className="gap-1 text-sm"
        >
          {loadingSuggestions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-foreground" />}
          Przelicz ponownie
        </Button>
      </div>

      {loadingSuggestions ? (
        <div className="py-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Analizowanie wolnych miejsc...
        </div>
      ) : suggestions.length === 0 ? (
        <div className="p-4 bg-muted text-foreground text-sm rounded-lg border border-border">
          Brak dostępnych wolnych łóżek spełniających kryteria. Możesz przyjąć podopiecznego bez przypisania łóżka.
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {suggestions.map((s) => {
            const isSelected = selectedBedId === s.bedId
            return (
              <button
                type="button"
                key={s.bedId}
                onClick={() => {
                  setSelectedBedId(s.bedId)
                  setSelectedBedInfo(`Pokój ${s.roomNumber} (piętro ${s.floorNumber}), Łóżko ${s.bedNumber}`)
                }}
                className={`w-full text-left p-3 rounded-lg border cursor-pointer transition-all flex items-start justify-between outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-border bg-card'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bed className="w-4 h-4 text-foreground" />
                    <span className="font-semibold text-sm text-foreground">
                      Pokój {s.roomNumber} — Łóżko {s.bedNumber}
                    </span>
                    <Badge variant="outline" className="text-sm font-normal">
                      Piętro {s.floorNumber}
                    </Badge>
                    <Badge variant="outline" className="text-sm font-normal text-muted-foreground">
                      Dopasowanie: {s.score} pkt
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {s.reason}
                  </p>
                </div>
                <div className="pt-1">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="pt-2 border-t flex items-center justify-between text-sm text-muted-foreground">
        <span>{selectedBedInfo ? `Wybrano: ${selectedBedInfo}` : 'Nie wybrano żadnego łóżka'}</span>
        {selectedBedId && (
          <button
            type="button"
            onClick={() => {
              setSelectedBedId(null)
              setSelectedBedInfo(null)
            }}
            className="text-destructive hover:underline"
          >
            Odznacz wybór
          </button>
        )}
      </div>
    </div>
  )
}
