'use client'

import React from 'react'
import { Search, Filter } from 'lucide-react'
import { ViewToggle, GRID_TABLE_OPTIONS } from '@/components/patterns/ViewToggle'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

interface RoomFilterToolbarProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
  viewMode: 'grid' | 'table'
  onModeChange: (mode: 'grid' | 'table') => void
  selectedFloor: string
  setSelectedFloor: (floor: string) => void
  availableFloors: string[]
  selectedSector: string
  setSelectedSector: (sector: string) => void
  availableSectors: string[]
  selectedOccupancy: 'all' | 'free' | 'full'
  setSelectedOccupancy: (occupancy: 'all' | 'free' | 'full') => void
  filteredCount: number
  totalCount: number
  formatSectorName: (sector?: string | null) => string
}

export function RoomFilterToolbar({
  searchQuery,
  setSearchQuery,
  viewMode,
  onModeChange,
  selectedFloor,
  setSelectedFloor,
  availableFloors,
  selectedSector,
  setSelectedSector,
  availableSectors,
  selectedOccupancy,
  setSelectedOccupancy,
  filteredCount,
  totalCount,
  formatSectorName,
}: RoomFilterToolbarProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-card p-4 border border-border">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Szukaj pokoju..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        </div>

        <ViewToggle value={viewMode} onChange={onModeChange} options={GRID_TABLE_OPTIONS} />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-3 border-t text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium">
          <Filter className="w-3.5 h-3.5" />
          <span>Filtry:</span>
        </div>

        <NativeSelect
          name="floorFilter"
          value={selectedFloor}
          onChange={(e) => setSelectedFloor(e.target.value)}
        >
          <NativeSelectOption value="all">Wszystkie piętra</NativeSelectOption>
          {availableFloors.map((floor) => (
            <NativeSelectOption key={floor} value={floor}>
              {floor}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        {availableSectors.length > 0 && (
          <NativeSelect
            name="sectorFilter"
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
          >
            <NativeSelectOption value="all">Wszystkie sektory</NativeSelectOption>
            {availableSectors.map((sector) => (
              <NativeSelectOption key={sector} value={sector}>
                {formatSectorName(sector)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}

        <NativeSelect
          name="occupancyFilter"
          value={selectedOccupancy}
          onChange={(e) => {
            const val = e.target.value
            if (val === 'all' || val === 'free' || val === 'full') {
              setSelectedOccupancy(val)
            }
          }}
        >
          <NativeSelectOption value="all">Wszystkie pokoje</NativeSelectOption>
          <NativeSelectOption value="free">Tylko z wolnymi miejscami</NativeSelectOption>
          <NativeSelectOption value="full">W pełni zajęte</NativeSelectOption>
        </NativeSelect>

        <div className="ml-auto text-sm text-muted-foreground">
          Znaleziono: <strong>{filteredCount}</strong> z {totalCount} pokoi
        </div>
      </div>
    </div>
  )
}
