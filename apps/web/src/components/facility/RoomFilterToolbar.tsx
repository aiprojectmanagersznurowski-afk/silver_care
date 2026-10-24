'use client'

import React from 'react'
import { ViewToggle, GRID_TABLE_OPTIONS } from '@/components/patterns/ViewToggle'
import { ListToolbar, SearchField } from '@/components/patterns/ListToolbar'
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
    <ListToolbar end={<ViewToggle value={viewMode} onChange={onModeChange} options={GRID_TABLE_OPTIONS} />}>
        <SearchField value={searchQuery} onChange={setSearchQuery} label="Szukaj pokoju" placeholder="Szukaj pokoju..." />

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

        <span className="text-sm text-muted-foreground">
          Znaleziono: <strong>{filteredCount}</strong> z {totalCount} pokoi
        </span>
    </ListToolbar>
  )
}
