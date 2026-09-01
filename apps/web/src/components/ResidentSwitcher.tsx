'use client'

import { useState } from 'react'

interface Resident {
  id: string
  first_name: string
  last_name: string
}

interface ResidentSwitcherProps {
  residents: Resident[]
  selectedId: string
  onSelect: (id: string) => void
}

/**
 * Przełącznik podopiecznych. Pojawia się wyłącznie gdy rodzina ma
 * więcej niż jednego aktywnego podopiecznego (FAM-MULTI-RESIDENT).
 */
export function ResidentSwitcher({ residents, selectedId, onSelect }: ResidentSwitcherProps) {
  if (residents.length <= 1) return null

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Wybierz podopiecznego">
      {residents.map((r) => (
        <button
          key={r.id}
          role="tab"
          aria-selected={r.id === selectedId}
          onClick={() => onSelect(r.id)}
          className={`
            inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all
            ${r.id === selectedId
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }
          `}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
            {r.first_name[0]}{r.last_name[0]}
          </span>
          {r.first_name} {r.last_name}
        </button>
      ))}
    </div>
  )
}
