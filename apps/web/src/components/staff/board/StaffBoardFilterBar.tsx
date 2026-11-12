'use client'

import React from 'react'
import { MessageSquare } from 'lucide-react'
import { FilterChip, FilterSelect, ListToolbar, SearchField } from '@/components/patterns/ListToolbar'
import { STATUS_CONFIG, NoteStatus } from './staff-board-types'

interface StaffBoardFilterBarProps {
  searchFilter: string
  onSearchChange: (val: string) => void
  floorFilter: string
  onFloorChange: (val: string) => void
  roomFilter: string
  onRoomChange: (val: string) => void
  statusFilter: string
  onStatusChange: (val: string) => void
  onlyUnansweredFilter: boolean
  onToggleOnlyUnanswered: () => void
  activeFiltersCount: number
  totalResidentsCount: number
  filteredCount: number
  floors: string[]
  roomsForCurrentFloor: string[]
  totalUnansweredCount: number
}

/** Filtry tablicy dyżuru we wspólnym pasku listy (ADR-017); wyczyszczenie wszystkich — przycisk w nagłówku. */
export function StaffBoardFilterBar({
  searchFilter,
  onSearchChange,
  floorFilter,
  onFloorChange,
  roomFilter,
  onRoomChange,
  statusFilter,
  onStatusChange,
  onlyUnansweredFilter,
  onToggleOnlyUnanswered,
  totalResidentsCount,
  filteredCount,
  floors,
  roomsForCurrentFloor,
  totalUnansweredCount,
}: StaffBoardFilterBarProps) {
  return (
    <div data-testid="filter-token-bar">
      <ListToolbar
        end={
          <span className="text-sm text-muted-foreground">
            Wyników: <span className="font-semibold text-foreground">{filteredCount}</span> z {totalResidentsCount}
          </span>
        }
      >
        <SearchField
          value={searchFilter}
          onChange={onSearchChange}
          label="Szukaj podopiecznego"
          placeholder="Szukaj podopiecznego..."
        />

        <FilterSelect
          label="Status"
          name="status"
          value={statusFilter}
          allLabel="Wszystkie statusy"
          options={(['none', 'draft', 'ready'] as NoteStatus[]).map((st) => ({
            value: st,
            label: STATUS_CONFIG[st].label,
          }))}
          onChange={onStatusChange}
        />

        {floors.length > 0 && (
          <FilterSelect
            label="Piętro"
            name="floor"
            value={floorFilter}
            allLabel="Wszystkie piętra"
            options={floors.map((f) => ({ value: f, label: `Piętro ${f}` }))}
            onChange={onFloorChange}
          />
        )}

        {floorFilter !== 'all' && roomsForCurrentFloor.length > 0 && (
          <FilterSelect
            label="Sala"
            name="room"
            value={roomFilter}
            allLabel="Wszystkie sale"
            options={roomsForCurrentFloor.map((r) => ({ value: r, label: `Pokój ${r}` }))}
            onChange={onRoomChange}
          />
        )}

        {(totalUnansweredCount > 0 || onlyUnansweredFilter) && (
          <div data-filter-group="messages">
            <FilterChip
              data-testid="filter-unanswered-messages"
              active={onlyUnansweredFilter}
              onClick={onToggleOnlyUnanswered}
            >
              <MessageSquare className="size-3.5" />
              Oczekujące wiadomości ({totalUnansweredCount})
            </FilterChip>
          </div>
        )}
      </ListToolbar>
    </div>
  )
}
