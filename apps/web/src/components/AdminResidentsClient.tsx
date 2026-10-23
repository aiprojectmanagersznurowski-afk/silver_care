'use client'

import React, { useState } from 'react'
import { ViewToggle, GRID_TABLE_OPTIONS } from '@/components/patterns/ViewToggle'
import { ListToolbar, SearchField } from '@/components/patterns/ListToolbar'
import { ResidentGridCard } from '@/components/residents/ResidentGridCard'
import { ResidentsTable } from '@/components/residents/ResidentsTable'
import { useViewPreference, VIEW_PREFERENCE_KEYS } from '@/hooks/use-view-preference'
import type { ResidentWithAssignments } from '@/components/residents/resident-list-types'

export type { ResidentWithAssignments } from '@/components/residents/resident-list-types'

interface AdminResidentsClientProps {
  residents: ResidentWithAssignments[]
}

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
      <ListToolbar end={<ViewToggle value={viewMode} onChange={setViewMode} options={GRID_TABLE_OPTIONS} />}>
        <SearchField value={searchQuery} onChange={setSearchQuery} label="Szukaj podopiecznego" placeholder="Szukaj podopiecznego..." />
      </ListToolbar>

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
