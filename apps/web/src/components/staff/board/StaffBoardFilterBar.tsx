'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Search, X, MessageSquare } from 'lucide-react'
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
  activeFiltersCount,
  totalResidentsCount,
  filteredCount,
  floors,
  roomsForCurrentFloor,
  totalUnansweredCount,
}: StaffBoardFilterBarProps) {
  return (
    <Card data-testid="filter-token-bar" className="rounded-xl border-none ring-1 ring-border bg-card">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Szukaj podopiecznego..."
              className="w-full h-11 pl-10 pr-9 rounded-xl border border-border bg-muted/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              value={searchFilter}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="text-sm font-medium text-muted-foreground self-end sm:self-center">
            Wyników: <span className="font-semibold text-foreground">{filteredCount}</span> z {totalResidentsCount}
          </div>
        </div>

        <div className="space-y-2.5 pt-1 border-t border-border">
          <div data-filter-group="status" className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-muted-foreground w-14 shrink-0">Status:</span>
            <button
              type="button"
              onClick={() => onStatusChange('all')}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-foreground text-background'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              Wszystkie
            </button>
            {(['none', 'draft', 'ready'] as NoteStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => onStatusChange(st)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  statusFilter === st
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground ring-1 ring-inset ring-border hover:bg-muted'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {STATUS_CONFIG[st].label}
              </button>
            ))}
          </div>

          {floors.length > 0 && (
            <div data-filter-group="floor" className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium text-muted-foreground w-14 shrink-0">Piętro:</span>
              <button
                type="button"
                onClick={() => onFloorChange('all')}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  floorFilter === 'all'
                    ? 'bg-foreground text-background'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Wszystkie
              </button>
              {floors.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFloorChange(f)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    floorFilter === f
                      ? 'bg-foreground text-background'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  Piętro {f}
                </button>
              ))}
            </div>
          )}

          {floorFilter !== 'all' && roomsForCurrentFloor.length > 0 && (
            <div data-filter-group="room" className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium text-muted-foreground w-14 shrink-0">Sala:</span>
              <button
                type="button"
                onClick={() => onRoomChange('all')}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  roomFilter === 'all'
                    ? 'bg-foreground text-background'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Wszystkie
              </button>
              {roomsForCurrentFloor.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRoomChange(r)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    roomFilter === r
                      ? 'bg-foreground text-background'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  Pokój {r}
                </button>
              ))}
            </div>
          )}

          <div data-filter-group="messages" className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-sm font-medium text-muted-foreground w-14 shrink-0">Kontakt:</span>
            <button
              type="button"
              data-testid="filter-unanswered-messages"
              onClick={onToggleOnlyUnanswered}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                onlyUnansweredFilter
                  ? 'bg-primary text-primary-foreground'
                  : totalUnansweredCount > 0
                  ? 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Oczekujące wiadomości ({totalUnansweredCount})</span>
            </button>
          </div>
        </div>

        {activeFiltersCount > 0 && (
          <div className="pt-2 border-t border-border flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Aktywne filtry:
            </span>
            {searchFilter && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-sm font-medium px-2.5 py-0.5 rounded-full">
                Szukaj: &quot;{searchFilter}&quot;
                <button type="button" onClick={() => onSearchChange('')} className="hover:opacity-75">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {onlyUnansweredFilter && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-sm font-medium px-2.5 py-0.5 rounded-full border border-primary/20">
                <MessageSquare className="h-3 w-3" />
                Tylko z oczekującą wiadomością
                <button type="button" onClick={onToggleOnlyUnanswered} className="hover:opacity-75">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 bg-muted text-foreground text-sm font-medium px-2.5 py-0.5 rounded-full">
                Status: {STATUS_CONFIG[statusFilter as NoteStatus]?.label}
                <button type="button" onClick={() => onStatusChange('all')} className="hover:opacity-75">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {floorFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 bg-muted text-foreground text-sm font-medium px-2.5 py-0.5 rounded-full">
                Piętro: {floorFilter}
                <button type="button" onClick={() => onFloorChange('all')} className="hover:opacity-75">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {roomFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 bg-muted text-foreground text-sm font-medium px-2.5 py-0.5 rounded-full">
                Pokój: {roomFilter}
                <button type="button" onClick={() => onRoomChange('all')} className="hover:opacity-75">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
