'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/patterns/TableCard'
import { ListEmpty, ListLoading } from '@/components/patterns/ListState'
import { Search, Mic } from 'lucide-react'
import { ViewToggle, GRID_TABLE_OPTIONS } from '@/components/patterns/ViewToggle'
import { useViewPreference, VIEW_PREFERENCE_KEYS } from '@/hooks/use-view-preference'

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
  const [viewMode, setViewMode] = useViewPreference(
    VIEW_PREFERENCE_KEYS.voiceResidents,
    'table',
    ['table', 'grid'] as const
  )
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
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <input
            id="search-resident"
            type="text"
            placeholder="Wpisz imię lub nazwisko podopiecznego..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-touch rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Wybierz podopiecznego ({filteredResidents.length})
          </h4>
          <ViewToggle value={viewMode} onChange={setViewMode} options={GRID_TABLE_OPTIONS} />
        </div>

        {loadingResidents ? (
          <ListLoading label="Wczytywanie listy podopiecznych" />
        ) : filteredResidents.length === 0 ? (
          <ListEmpty title="Nie znaleziono podopiecznych" description="Zmień wyszukiwaną frazę." />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
            {filteredResidents.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelectResident(r)}
                className="flex items-center gap-3 p-3 min-h-touch rounded-xl border border-border bg-background hover:bg-muted/50 hover:border-primary/50 text-left transition-all"
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
        ) : (
          <TableCard>
          <div className="max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Podopieczny</TableHead>
                  <TableHead className="w-40 text-right">Akcja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResidents.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                          {r.first_name?.[0]}{r.last_name?.[0]}
                        </div>
                        <span className="font-semibold text-sm text-foreground">
                          {r.first_name} {r.last_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => onSelectResident(r)}
                        aria-label={`Kliknij, aby nagrać notatkę dla: ${r.first_name} ${r.last_name}`}
                        className="inline-flex items-center justify-center gap-1.5 min-h-touch px-3 rounded-lg bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors text-sm font-medium"
                      >
                        <Mic className="w-4 h-4" />
                        Kliknij, aby nagrać
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </TableCard>
        )}
      </div>
    </Card>
  )
}
