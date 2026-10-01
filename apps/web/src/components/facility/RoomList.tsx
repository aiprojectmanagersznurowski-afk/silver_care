'use client'

import { useState, useMemo } from 'react'
import {
  ChevronDown,
  ChevronUp,
  DoorOpen,
  LayoutGrid,
  Table as TableIcon,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import BedList from './BedList'
import AddBedDialog from './AddBedDialog'
import { isGroundFloor } from '@/lib/bed-allocation-optimizer'

interface RoomItem {
  id: string
  number: string
  floor: string
  sector?: string | null
  beds: number
  occupied: number
  free: number
  is_active?: boolean
  genderDistribution?: {
    males: number
    females: number
  }
}

interface RoomListProps {
  rooms: RoomItem[]
  onUpdate: () => void
}

export default function RoomList({ rooms, onUpdate }: RoomListProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({})

  // Filtry
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFloor, setSelectedFloor] = useState('all')
  const [selectedSector, setSelectedSector] = useState('all')
  const [selectedOccupancy, setSelectedOccupancy] = useState<'all' | 'free' | 'full'>('all')

  const toggleRoom = (roomId: string) => {
    setExpandedRooms((prev) => ({ ...prev, [roomId]: !prev[roomId] }))
  }

  // Wyciągamy unikalne piętra i sektory
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

  // Filtrowanie pokoi
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // 1. Filtr piętra
      if (selectedFloor !== 'all' && room.floor !== selectedFloor) return false

      // 2. Filtr sektora
      if (selectedSector !== 'all' && room.sector !== selectedSector) return false

      // 3. Filtr obłożenia
      if (selectedOccupancy === 'free' && room.free <= 0) return false
      if (selectedOccupancy === 'full' && room.free > 0) return false

      // 4. Szukaj
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        if (!room.number.toLowerCase().includes(q)) return false
      }

      return true
    })
  }, [rooms, selectedFloor, selectedSector, selectedOccupancy, searchQuery])

  // Pomocnik do wyznaczania reguły płci w pokoju
  const getRoomGenderLabel = (room: RoomItem) => {
    if (!room.occupied || room.occupied === 0) {
      return { label: 'Wolny pokój', variant: 'neutral' as const }
    }
    const dist = room.genderDistribution
    if (dist) {
      if (dist.males > 0 && dist.females > 0) {
        return { label: `Mieszany (${dist.males}M / ${dist.females}K)`, variant: 'warning' as const }
      }
      if (dist.males > 0) {
        return { label: `Mężczyźni (${dist.males})`, variant: 'male' as const }
      }
      if (dist.females > 0) {
        return { label: `Kobiety (${dist.females})`, variant: 'female' as const }
      }
    }
    return { label: `${room.occupied} zajęte`, variant: 'neutral' as const }
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center p-12 bg-muted/20 rounded-lg border border-dashed">
        <DoorOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Brak pokoi w placówce</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Dodaj pierwszy pokój, aby rozpocząć zarządzanie strukturą i łóżkami.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 mt-8">
      {/* Pasek narzędziowy: Przełącznik widoku oraz Filtry */}
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm border border-slate/10">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Wyszukiwarka */}
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

          {/* Przełącznik trybu widoku */}
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl self-end sm:self-auto border">
            <Button
              type="button"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className={`h-8 px-3 rounded-lg text-xs font-medium ${
                viewMode === 'grid' ? 'bg-sage hover:bg-sage-dark text-white' : 'text-slate'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
              Kafelki
            </Button>
            <Button
              type="button"
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className={`h-8 px-3 rounded-lg text-xs font-medium ${
                viewMode === 'table' ? 'bg-sage hover:bg-sage-dark text-white' : 'text-slate'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 mr-1.5" />
              Tabela
            </Button>
          </div>
        </div>

        {/* Kontrolki filtrów */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtry:</span>
          </div>

          {/* Piętro */}
          <select
            name="floorFilter"
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-slate focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Wszystkie piętra</option>
            {availableFloors.map((floor) => (
              <option key={floor} value={floor}>
                {floor}
              </option>
            ))}
          </select>

          {/* Sektor */}
          {availableSectors.length > 0 && (
            <select
              name="sectorFilter"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-slate focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Wszystkie sektory</option>
              {availableSectors.map((sector) => (
                <option key={sector} value={sector}>
                  Sektor {sector}
                </option>
              ))}
            </select>
          )}

          {/* Stan obłożenia */}
          <select
            name="occupancyFilter"
            value={selectedOccupancy}
            onChange={(e) => {
              const val = e.target.value
              if (val === 'all' || val === 'free' || val === 'full') {
                setSelectedOccupancy(val)
              }
            }}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-slate focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Wszystkie pokoje</option>
            <option value="free">Tylko z wolnymi miejscami</option>
            <option value="full">W pełni zajęte</option>
          </select>

          {/* Licznik wyników */}
          <div className="ml-auto text-xs text-muted-foreground">
            Znaleziono: <strong>{filteredRooms.length}</strong> z {rooms.length} pokoi
          </div>
        </div>
      </div>

      {filteredRooms.length === 0 ? (
        <div className="text-center p-8 bg-muted/10 rounded-xl border border-dashed">
          <p className="text-sm text-muted-foreground">
            Brak pokoi spełniających wybrane kryteria filtrów.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* WIDOK KAFELKOWY */
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredRooms.map((room) => {
            const genderInfo = getRoomGenderLabel(room)
            const isGround = isGroundFloor(room.floor)
            const isExpanded = expandedRooms[room.id]

            return (
              <Card
                key={room.id}
                data-testid="room-card"
                className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                  isExpanded ? 'ring-2 ring-sage/30 shadow-md' : 'hover:shadow-sm'
                }`}
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <DoorOpen className="w-5 h-5 text-sage" />
                        <h4 className="font-semibold text-base text-slate">Pokój {room.number}</h4>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {room.floor} {room.sector ? `• Sektor ${room.sector}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full ${
                          room.free > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {room.free > 0 ? `${room.free} wolne` : 'Zajęty'}
                      </span>
                    </div>
                  </div>

                  {/* Transparentne reguły alokacji */}
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {/* Reguła parteru */}
                    {isGround ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700 border border-blue-200/60">
                        <CheckCircle2 className="w-3 h-3 text-blue-600" />
                        Parter (ZSN / leżący)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-slate-600 border border-slate-200/60">
                        <Info className="w-3 h-3 text-slate-400" />
                        Wyższe piętro
                      </span>
                    )}

                    {/* Reguła płci */}
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium border ${
                        genderInfo.variant === 'warning'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : genderInfo.variant === 'male'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : genderInfo.variant === 'female'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {genderInfo.variant === 'warning' && (
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                      )}
                      {genderInfo.label}
                    </span>
                  </div>

                  {/* Pasek postępu zajętości */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Łóżka ({room.occupied || 0}/{room.beds || 0})</span>
                      <span>{room.free || 0} wolnych</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          room.free === 0 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${room.beds > 0 ? ((room.occupied || 0) / room.beds) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Przycisk rozwijania łóżek */}
                  <div className="pt-2 border-t flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRoom(room.id)}
                      className="text-xs text-sage hover:text-sage-dark font-medium p-0 h-auto"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5 mr-1" />
                          Zwiń łóżka
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5 mr-1" />
                          Zarządzaj łóżkami ({room.beds || 0})
                        </>
                      )}
                    </Button>
                    <AddBedDialog roomId={room.id} onBedAdded={onUpdate} />
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="bg-slate-50/60 p-4 border-t">
                    <BedList
                      roomId={room.id}
                      roomNumber={room.number}
                      floor={room.floor}
                      onUpdate={onUpdate}
                    />
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      ) : (
        /* WIDOK TABELARYCZNY */
        <div
          data-testid="room-table"
          className="rounded-2xl border border-slate/10 bg-white overflow-hidden shadow-sm"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs font-semibold uppercase text-slate-soft border-b">
                <tr>
                  <th className="py-3 px-4">Pokój</th>
                  <th className="py-3 px-4">Piętro</th>
                  <th className="py-3 px-4">Sektor</th>
                  <th className="py-3 px-4 text-center">Łóżka</th>
                  <th className="py-3 px-4 text-center">Obłożenie</th>
                  <th className="py-3 px-4">Reguły alokacji</th>
                  <th className="py-3 px-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/10">
                {filteredRooms.map((room) => {
                  const genderInfo = getRoomGenderLabel(room)
                  const isGround = isGroundFloor(room.floor)
                  const isExpanded = expandedRooms[room.id]

                  return (
                    <tr
                      key={room.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate">
                        <div className="flex items-center gap-2">
                          <DoorOpen className="w-4 h-4 text-sage" />
                          <span>Pokój {room.number}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-soft">{room.floor}</td>
                      <td className="py-3.5 px-4 text-slate-soft">
                        {room.sector ? `Sektor ${room.sector}` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-medium">
                        {room.beds || 0}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            room.free > 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {room.occupied || 0} / {room.beds || 0} ({room.free || 0} wolnych)
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          {isGround && (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
                              Parter
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                              genderInfo.variant === 'warning'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {genderInfo.label}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <AddBedDialog roomId={room.id} onBedAdded={onUpdate} />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRoom(room.id)}
                            className="h-8 px-2 text-xs text-sage hover:text-sage-dark"
                          >
                            {isExpanded ? 'Zwiń' : 'Łóżka'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
