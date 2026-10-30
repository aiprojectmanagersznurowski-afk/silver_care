'use client'

import React, { useState } from 'react'
import { ViewToggle, GRID_TABLE_OPTIONS } from '@/components/patterns/ViewToggle'
import { ListToolbar, SearchField } from '@/components/patterns/ListToolbar'
import { TableCard } from '@/components/patterns/TableCard'
import { ObjectGrid } from '@/components/patterns/ObjectCard'
import { ListEmpty } from '@/components/patterns/ListState'
import { ResidentGridCard } from '@/components/residents/ResidentGridCard'
import { ResidentsTable, RESIDENTS_PAGE_SIZE } from '@/components/residents/ResidentsTable'
import { ListPagination, usePagination } from '@/components/patterns/ListPagination'
import { useViewPreference, VIEW_PREFERENCE_KEYS } from '@/hooks/use-view-preference'
import type { ResidentWithAssignments } from '@/components/residents/resident-list-types'
import { matchesPersonName, sortByPersonName } from '@/lib/person-name'

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

  // Domyślna kolejność: po nazwisku, potem imieniu (decyzja Michała 2026-10-26)
  const filteredResidents = sortByPersonName(residents || []).filter((r) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return matchesPersonName(r.first_name, r.last_name, searchQuery) || r.id.toLowerCase().includes(q)
  })
  // Kafelki: ta sama wielkość strony co tabela; zmiana frazy albo widoku wraca na stronę 1
  const gridPagination = usePagination(filteredResidents.length, RESIDENTS_PAGE_SIZE, `${searchQuery}|${viewMode}`)

  return (
    <TableCard
      toolbar={
        <ListToolbar end={<ViewToggle value={viewMode} onChange={setViewMode} options={GRID_TABLE_OPTIONS} />}>
          <SearchField value={searchQuery} onChange={setSearchQuery} label="Szukaj podopiecznego" placeholder="Szukaj podopiecznego..." />
        </ListToolbar>
      }
    >
      {filteredResidents.length === 0 ? (
        <ListEmpty
          framed={false}
          title={searchQuery ? 'Brak podopiecznych pasujących do wyszukiwania' : 'Brak podopiecznych w bazie'}
          description={searchQuery ? 'Zmień wyszukiwaną frazę.' : 'Przyjmij pierwszego podopiecznego przyciskiem u góry strony.'}
        />
      ) : viewMode === 'grid' ? (
        <div className="p-4">
          <ObjectGrid>
            {gridPagination.slice(filteredResidents).map((resident) => (
              <ResidentGridCard key={resident.id} resident={resident} />
            ))}
          </ObjectGrid>
          <ListPagination
            total={filteredResidents.length}
            from={gridPagination.from}
            to={gridPagination.to}
            page={gridPagination.page}
            totalPages={gridPagination.totalPages}
            onPrev={gridPagination.prev}
            onNext={gridPagination.next}
          />
        </div>
      ) : (
        <ResidentsTable residents={filteredResidents} resetKey={searchQuery} />
      )}
    </TableCard>
  )
}
