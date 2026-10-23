'use client'

import { useState, useMemo } from 'react'
import { DoorOpen } from 'lucide-react'
import { useViewPreference, VIEW_PREFERENCE_KEYS } from '@/hooks/use-view-preference'
import { RoomFilterToolbar } from './RoomFilterToolbar'
import { TableCard } from '@/components/patterns/TableCard'
import { ListEmpty } from '@/components/patterns/ListState'
import { RoomGridView } from './RoomGridView'
import { RoomTableView } from './RoomTableView'
import type { RoomItem } from './room-helpers'

export type { RoomItem }

interface RoomListProps {
  rooms: RoomItem[]
  onUpdate: () => void
}

export function formatSectorName(sector?: string | null): string {
  if (!sector) return '—'
  const trimmed = sector.trim()
  if (!trimmed) return '—'
  return trimmed.toLowerCase().startsWith('sektor') ? trimmed : `Sektor ${trimmed}`
}

export default function RoomList({ rooms, onUpdate }: RoomListProps) {
  const [viewMode, setViewMode] = useViewPreference(
    VIEW_PREFERENCE_KEYS.facilityRooms,
    'table',
    ['table', 'grid'] as const
  )
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({})

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFloor, setSelectedFloor] = useState('all')
  const [selectedSector, setSelectedSector] = useState('all')
  const [selectedOccupancy, setSelectedOccupancy] = useState<'all' | 'free' | 'full'>('all')

  const toggleRoom = (roomId: string) => {
    setExpandedRooms((prev) => ({ ...prev, [roomId]: !prev[roomId] }))
  }

  const availableFloors = useMemo(() => {
    const floors = new Set<string>()
    rooms.forEach((r) => {
      if (r.floor) floors.add(r.floor)
    })
    return Array.from(floors).sort()
  }, [rooms])

  const availableSectors = useMemo(() => {
    const sectors = new Set<string>()
    rooms.forEach((r) => {
      if (r.sector) sectors.add(r.sector)
    })
    return Array.from(sectors).sort()
  }, [rooms])

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      if (selectedFloor !== 'all' && room.floor !== selectedFloor) return false
      if (selectedSector !== 'all' && room.sector !== selectedSector) return false
      if (selectedOccupancy === 'free' && room.free <= 0) return false
      if (selectedOccupancy === 'full' && room.free > 0) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        if (!room.number.toLowerCase().includes(q)) return false
      }

      return true
    })
  }, [rooms, selectedFloor, selectedSector, selectedOccupancy, searchQuery])

  if (rooms.length === 0) {
    return (
      <div className="mt-8">
        <ListEmpty icon={<DoorOpen />} title="Brak pokoi w placówce" description="Dodaj pierwszy pokój, aby rozpocząć zarządzanie strukturą i łóżkami." />
      </div>
    )
  }

  return (
    <TableCard
      className="mt-8"
      toolbar={
      <RoomFilterToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        viewMode={viewMode}
        onModeChange={setViewMode}
        selectedFloor={selectedFloor}
        setSelectedFloor={setSelectedFloor}
        availableFloors={availableFloors}
        selectedSector={selectedSector}
        setSelectedSector={setSelectedSector}
        availableSectors={availableSectors}
        selectedOccupancy={selectedOccupancy}
        setSelectedOccupancy={setSelectedOccupancy}
        filteredCount={filteredRooms.length}
        totalCount={rooms.length}
        formatSectorName={formatSectorName}
      />
      }
    >
      {filteredRooms.length === 0 ? (
        <ListEmpty framed={false} title="Brak pokoi spełniających wybrane filtry" description="Zmień filtry lub wyszukiwaną frazę." />
      ) : viewMode === 'grid' ? (
        <div className="p-4">
        <RoomGridView
          rooms={filteredRooms}
          expandedRooms={expandedRooms}
          toggleRoom={toggleRoom}
          onUpdate={onUpdate}
          formatSectorName={formatSectorName}
        />
        </div>
      ) : (
        <RoomTableView
          rooms={filteredRooms}
          expandedRooms={expandedRooms}
          toggleRoom={toggleRoom}
          onUpdate={onUpdate}
          formatSectorName={formatSectorName}
        />
      )}
    </TableCard>
  )
}
