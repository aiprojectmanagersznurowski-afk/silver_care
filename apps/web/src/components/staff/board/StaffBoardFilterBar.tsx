'use client'

import React from 'react'
import { MessageSquare } from 'lucide-react'
import { FilterChip, FilterGroup, ListToolbar, SearchField } from '@/components/patterns/ListToolbar'
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
    <div data-testid="filter-token-bar" className="space-y-3">
      <ListToolbar
        end={
          <span className="text-sm text-muted-foreground">
            Wyników: <span className="font-semibold text-foreground">{filteredCount}</span> z {totalResidentsCount}
          </span>
        }
      >
        <SearchField value={searchFilter} onChange={onSearchChange} label="Szukaj podopiecznego" placeholder="Szukaj podopiecznego..." />
      </ListToolbar>

      <div className="space-y-2">
        <FilterGroup label="Status" name="status">
          <FilterChip active={statusFilter === 'all'} onClick={() => onStatusChange('all')}>Wszystkie</FilterChip>
          {(['none', 'draft', 'ready'] as NoteStatus[]).map((st) => (
            <FilterChip key={st} active={statusFilter === st} onClick={() => onStatusChange(st)}>
              {STATUS_CONFIG[st].label}
            </FilterChip>
          ))}
        </FilterGroup>

        {floors.length > 0 && (
          <FilterGroup label="Piętro" name="floor">
            <FilterChip active={floorFilter === 'all'} onClick={() => onFloorChange('all')}>Wszystkie</FilterChip>
            {floors.map((f) => (
              <FilterChip key={f} active={floorFilter === f} onClick={() => onFloorChange(f)}>
                Piętro {f}
              </FilterChip>
            ))}
          </FilterGroup>
        )}

        {floorFilter !== 'all' && roomsForCurrentFloor.length > 0 && (
          <FilterGroup label="Sala" name="room">
            <FilterChip active={roomFilter === 'all'} onClick={() => onRoomChange('all')}>Wszystkie</FilterChip>
            {roomsForCurrentFloor.map((r) => (
              <FilterChip key={r} active={roomFilter === r} onClick={() => onRoomChange(r)}>
                Pokój {r}
              </FilterChip>
            ))}
          </FilterGroup>
        )}

        {(totalUnansweredCount > 0 || onlyUnansweredFilter) && (
          <FilterGroup label="Kontakt" name="messages">
            <FilterChip data-testid="filter-unanswered-messages" active={onlyUnansweredFilter} onClick={onToggleOnlyUnanswered}>
              <MessageSquare />
              Oczekujące wiadomości ({totalUnansweredCount})
            </FilterChip>
          </FilterGroup>
        )}
      </div>
    </div>
  )
}
