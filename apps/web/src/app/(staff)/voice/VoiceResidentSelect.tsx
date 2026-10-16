'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Search, Loader2 } from 'lucide-react'

interface ResidentItem {
  id: string
  first_name: string
  last_name: string
}

interface VoiceResidentSelectProps {
  searchQuery: string
  setSearchQuery: (val: string) => void
  residentsList: ResidentItem[]
  loadingResidents: boolean
  onSelectResident: (resident: ResidentItem) => void
}

export function VoiceResidentSelect({
  searchQuery,
  setSearchQuery,
  residentsList,
  loadingResidents,
  onSelectResident,
}: VoiceResidentSelectProps) {
  const filteredResidents = residentsList.filter((r) =>
    `${r.first_name} ${r.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Card className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="space-y-2">
        <label htmlFor="search-resident" className="text-sm font-medium text-foreground">
          Szukaj podopiecznego
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            id="search-resident"
            type="text"
            placeholder="Wpisz imię lub nazwisko podopiecznego..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Wybierz podopiecznego ({filteredResidents.length})
        </h4>
        {loadingResidents ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredResidents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nie znaleziono podopiecznych pasujących do wyszukiwania.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
            {filteredResidents.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelectResident(r)}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:bg-muted/50 hover:border-primary/50 text-left transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                  {r.first_name?.[0]}{r.last_name?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {r.first_name} {r.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">Kliknij, aby nagrać</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
