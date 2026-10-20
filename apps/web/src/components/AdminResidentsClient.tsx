'use client'

import React, { useState } from 'react'
import { LayoutGrid, Table as TableIcon, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResidentGridCard } from '@/components/residents/ResidentGridCard'
import { ResidentsTable } from '@/components/residents/ResidentsTable'
import { useViewPreference, VIEW_PREFERENCE_KEYS } from '@/hooks/use-view-preference'
import type { ResidentWithAssignments } from '@/components/residents/resident-list-types'

export type { ResidentWithAssignments } from '@/components/residents/resident-list-types'

interface AdminResidentsClientProps {
  residents: ResidentWithAssignments[]
}

const toggleClass = (active: boolean) =>
  `min-h-11 px-3 rounded-lg text-sm font-medium transition-all ${
    active ? 'bg-primary text-white hover:bg-primary/90' : 'text-foreground'
  }`

export function AdminResidentsClient({ residents }: AdminResidentsClientProps) {
  const [viewMode, setViewMode] = useViewPreference(
    VIEW_PREFERENCE_KEYS.residents,
    'table',
    ['grid', 'table'] as const
  )
  const [searchQuery, setSearchQuery] = useState('')

  const filteredResidents = (residents || []).filter((r) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const fullName = `${r.first_name} ${r.last_name}`.toLowerCase()
    return fullName.includes(q) || r.id.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      {/* Pasek narzędziowy: Wyszukiwarka + Przełącznik Kafelki / Tabela */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Szukaj podopiecznego..."
            aria-label="Szukaj podopiecznego"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex min-h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl self-end sm:self-auto border border-border">
          <Button
            type="button"
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            onClick={() => setViewMode('grid')}
            className={toggleClass(viewMode === 'grid')}
          >
            <LayoutGrid className="w-4 h-4 mr-1.5" />
            Kafelki
          </Button>
          <Button
            type="button"
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            onClick={() => setViewMode('table')}
            className={toggleClass(viewMode === 'table')}
          >
            <TableIcon className="w-4 h-4 mr-1.5" />
            Tabela
          </Button>
        </div>
      </div>

      {filteredResidents.length === 0 ? (
        <div className="rounded-xl bg-card p-8 text-center text-muted-foreground border border-border">
          {searchQuery ? 'Brak podopiecznych pasujących do wyszukiwania.' : 'Brak podopiecznych w bazie.'}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResidents.map((resident) => (
            <ResidentGridCard key={resident.id} resident={resident} />
          ))}
        </div>
      ) : (
        <ResidentsTable residents={filteredResidents} />
      )}
    </div>
  )
}
