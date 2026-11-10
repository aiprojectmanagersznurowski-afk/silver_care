'use client'

import React from 'react'
import { ChevronDown, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FilterChip, ListToolbar, SearchField } from '@/components/patterns/ListToolbar'
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
  const currentStatusLabel =
    statusFilter === 'all'
      ? 'Wszystkie'
      : STATUS_CONFIG[statusFilter as NoteStatus]?.label ?? statusFilter

  const currentFloorLabel =
    floorFilter === 'all' ? 'Wszystkie' : `Piętro ${floorFilter}`

  const currentRoomLabel =
    roomFilter === 'all' ? 'Wszystkie' : `Pokój ${roomFilter}`

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

      <div className="flex flex-wrap items-center gap-2">
        <div data-filter-group="status">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  aria-pressed={statusFilter !== 'all'}
                  className={`min-h-touch gap-1.5 px-3 ${
                    statusFilter !== 'all'
                      ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                      : ''
                  }`}
                />
              }
            >
              <span className="text-xs font-normal opacity-80">Status:</span>
              <span className="font-medium text-sm">{currentStatusLabel}</span>
              <ChevronDown className="size-3.5 shrink-0 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              <DropdownMenuRadioGroup value={statusFilter} onValueChange={(val) => onStatusChange(String(val))}>
                <DropdownMenuRadioItem value="all">Wszystkie statusy</DropdownMenuRadioItem>
                {(['none', 'draft', 'ready'] as NoteStatus[]).map((st) => (
                  <DropdownMenuRadioItem key={st} value={st}>
                    {STATUS_CONFIG[st].label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {floors.length > 0 && (
          <div data-filter-group="floor">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    aria-pressed={floorFilter !== 'all'}
                    className={`min-h-touch gap-1.5 px-3 ${
                      floorFilter !== 'all'
                        ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                        : ''
                    }`}
                  />
                }
              >
                <span className="text-xs font-normal opacity-80">Piętro:</span>
                <span className="font-medium text-sm">{currentFloorLabel}</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-40">
                <DropdownMenuRadioGroup value={floorFilter} onValueChange={(val) => onFloorChange(String(val))}>
                  <DropdownMenuRadioItem value="all">Wszystkie piętra</DropdownMenuRadioItem>
                  {floors.map((f) => (
                    <DropdownMenuRadioItem key={f} value={f}>
                      Piętro {f}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {floorFilter !== 'all' && roomsForCurrentFloor.length > 0 && (
          <div data-filter-group="room">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    aria-pressed={roomFilter !== 'all'}
                    className={`min-h-touch gap-1.5 px-3 ${
                      roomFilter !== 'all'
                        ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                        : ''
                    }`}
                  />
                }
              >
                <span className="text-xs font-normal opacity-80">Sala:</span>
                <span className="font-medium text-sm">{currentRoomLabel}</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto min-w-40">
                <DropdownMenuRadioGroup value={roomFilter} onValueChange={(val) => onRoomChange(String(val))}>
                  <DropdownMenuRadioItem value="all">Wszystkie sale</DropdownMenuRadioItem>
                  {roomsForCurrentFloor.map((r) => (
                    <DropdownMenuRadioItem key={r} value={r}>
                      Pokój {r}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
      </div>
    </div>
  )
}
