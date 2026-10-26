'use client'

import React, { useState, useMemo, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { quickLogRoutineObservationAction } from '@/actions/bulk-reports'
import { useViewPreference, VIEW_PREFERENCE_KEYS } from '@/hooks/use-view-preference'
import {
  StaffBoardClientProps,
  getNoteStatus,
  getFloorLabel,
  getRoomNumber,
} from './staff/board/staff-board-types'
import { StaffBoardHeader } from './staff/board/StaffBoardHeader'
import { StaffBoardFilterBar } from './staff/board/StaffBoardFilterBar'
import { StaffQuickRoundsCard } from './staff/board/StaffQuickRoundsCard'
import { StaffStandardCard } from './staff/board/StaffStandardCard'
import { StaffBoardTable } from './staff/board/StaffBoardTable'
import { TableCard } from '@/components/patterns/TableCard'
import { ObjectGrid } from '@/components/patterns/ObjectCard'
import { ListEmpty } from '@/components/patterns/ListState'
import { Button } from '@/components/ui/button'
import { matchesPersonName } from '@/lib/person-name'

export function StaffBoardClient({ residents, floors, unansweredMessagesMap = {} }: StaffBoardClientProps) {
  const [viewMode, setViewMode] = useViewPreference(
    VIEW_PREFERENCE_KEYS.staffBoard,
    'table',
    ['table', 'rounds', 'standard'] as const
  )
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [floorFilter, setFloorFilter] = useState<string>('all')
  const [roomFilter, setRoomFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [onlyUnansweredFilter, setOnlyUnansweredFilter] = useState<boolean>(false)

  const [loggedResidentIds, setLoggedResidentIds] = useState<Record<string, boolean>>({})
  const [pendingResidentId, setPendingResidentId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    void Promise.resolve().then(() => setRoomFilter('all'))
  }, [floorFilter])

  const totalUnansweredCount = useMemo(() => {
    return Object.values(unansweredMessagesMap).filter((s) => s.hasUnanswered).length
  }, [unansweredMessagesMap])

  const roomsForCurrentFloor = useMemo(() => {
    if (floorFilter === 'all') return []
    const rooms = new Set<string>()
    for (const r of residents) {
      if (getFloorLabel(r) === floorFilter) {
        const room = getRoomNumber(r)
        if (room) rooms.add(room)
      }
    }
    return Array.from(rooms).sort()
  }, [residents, floorFilter])

  const filtered = useMemo(() => {
    return residents.filter((r) => {
      const resId = String(r.id || '')
      if (onlyUnansweredFilter && !unansweredMessagesMap[resId]?.hasUnanswered) return false
      if (!matchesPersonName(r.first_name, r.last_name, searchFilter)) return false
      if (floorFilter !== 'all' && getFloorLabel(r) !== floorFilter) return false
      if (roomFilter !== 'all' && getRoomNumber(r) !== roomFilter) return false
      if (statusFilter !== 'all' && getNoteStatus(r) !== statusFilter) return false
      return true
    })
  }, [residents, searchFilter, floorFilter, roomFilter, statusFilter, onlyUnansweredFilter, unansweredMessagesMap])

  const clearFilters = () => {
    setSearchFilter('')
    setFloorFilter('all')
    setRoomFilter('all')
    setStatusFilter('all')
    setOnlyUnansweredFilter(false)
  }

  const handleQuickLog = (residentId: string) => {
    setPendingResidentId(residentId)
    startTransition(async () => {
      try {
        const res = await quickLogRoutineObservationAction(
          residentId,
          'Obchód rutynowy: Stan stabilny, podopieczny spokojny, bez uwag.'
        )
        if (res.success) {
          setLoggedResidentIds((prev) => ({ ...prev, [residentId]: true }))
          toast.success('Zapisano rutynową obserwację: Stan stabilny')
        } else {
          toast.error(res.error || 'Nie udało się zapisać obserwacji')
        }
      } catch (err: unknown) {
        console.error('Błąd zapisu obserwacji:', err)
        toast.error('Błąd zapisu obserwacji')
      } finally {
        setPendingResidentId(null)
      }
    })
  }

  const activeFiltersCount =
    (floorFilter !== 'all' ? 1 : 0) +
    (roomFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (searchFilter !== '' ? 1 : 0) +
    (onlyUnansweredFilter ? 1 : 0)

  return (
    <div className="space-y-6">
      <StaffBoardHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        activeFiltersCount={activeFiltersCount}
        onClearFilters={clearFilters}
      />

      <TableCard
        toolbar={
      <StaffBoardFilterBar
        searchFilter={searchFilter}
        onSearchChange={setSearchFilter}
        floorFilter={floorFilter}
        onFloorChange={setFloorFilter}
        roomFilter={roomFilter}
        onRoomChange={setRoomFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        onlyUnansweredFilter={onlyUnansweredFilter}
        onToggleOnlyUnanswered={() => setOnlyUnansweredFilter((prev) => !prev)}
        activeFiltersCount={activeFiltersCount}
        totalResidentsCount={residents.length}
        filteredCount={filtered.length}
        floors={floors}
        roomsForCurrentFloor={roomsForCurrentFloor}
        totalUnansweredCount={totalUnansweredCount}
      />
        }
      >
        {filtered.length === 0 ? (
          <ListEmpty
            framed={false}
            title="Brak podopiecznych"
            description="Nie znaleziono osób spełniających kryteria wyszukiwania."
            action={activeFiltersCount > 0 ? (
              <Button type="button" variant="outline" onClick={clearFilters}>Wyczyść wszystkie filtry</Button>
            ) : undefined}
          />
        ) : viewMode === 'table' ? (
          <StaffBoardTable residents={filtered} unansweredMessagesMap={unansweredMessagesMap} />
        ) : (
          <div className="p-4">
            <ObjectGrid>
              {filtered.map((resident) => {
                const resId = resident.id as string
                return viewMode === 'rounds' ? (
                  <StaffQuickRoundsCard
                    key={resId}
                    resident={resident}
                    isLogged={Boolean(loggedResidentIds[resId])}
                    isSubmitting={pendingResidentId === resId}
                    unansweredInfo={unansweredMessagesMap[resId]}
                    onQuickLog={handleQuickLog}
                  />
                ) : (
                  <StaffStandardCard key={resId} resident={resident} unansweredInfo={unansweredMessagesMap[resId]} />
                )
              })}
            </ObjectGrid>
          </div>
        )}
      </TableCard>
    </div>
  )
}
