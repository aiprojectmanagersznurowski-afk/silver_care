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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
      <div className="flex flex-col gap-4 rounded-xl bg-card p-4 border border-border">
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
                viewMode === 'grid' ? 'bg-primary hover:bg-primary/90 text-white' : 'text-foreground'
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
                viewMode === 'table' ? 'bg-primary hover:bg-primary/90 text-white' : 'text-foreground'
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

          {/* Sektor */}
          {availableSectors.length > 0 && (
            <NativeSelect
              name="sectorFilter"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
            >
              <NativeSelectOption value="all">Wszystkie sektory</NativeSelectOption>
              {availableSectors.map((sector) => (
                <NativeSelectOption key={sector} value={sector}>
                  Sektor {sector}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}

          {/* Stan obłożenia */}
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
                className={`overflow-hidden rounded-xl border transition-all duration-200 ${
                  isExpanded ? 'ring-2 ring-primary/30' : 'hover:bg-muted/40'
                }`}
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <DoorOpen className="w-5 h-5 text-primary" />
                        <h4 className="font-semibold text-base text-foreground">Pokój {room.number}</h4>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {room.floor} {room.sector ? `• Sektor ${room.sector}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full ${
                          room.free > 0
                            ? 'bg-muted text-foreground border border-border'
                            : 'bg-muted text-foreground border border-border'
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
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-medium text-foreground border border-border">
                        <CheckCircle2 className="w-3 h-3 text-foreground" />
                        Parter (ZSN / leżący)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-foreground border border-border">
                        <Info className="w-3 h-3 text-muted-foreground" />
                        Wyższe piętro
                      </span>
                    )}

                    {/* Reguła płci */}
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium border ${
                        genderInfo.variant === 'warning'
                          ? 'bg-muted text-foreground border-border'
                          : genderInfo.variant === 'male'
                          ? 'bg-muted text-foreground border-border'
                          : genderInfo.variant === 'female'
                          ? 'bg-muted text-foreground border-border'
                          : 'bg-muted text-foreground border-border'
                      }`}
                    >
                      {genderInfo.variant === 'warning' && (
                        <AlertTriangle className="w-3 h-3 text-foreground" />
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
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          room.free === 0 ? 'bg-primary' : 'bg-primary'
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
                      className="text-xs text-primary hover:text-primary font-medium p-0 h-auto"
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
                  <CardContent className="bg-muted p-4 border-t">
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
          className="rounded-xl border border-border bg-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="font-semibold text-muted-foreground">
                <TableRow>
                  <TableHead>Pokój</TableHead>
                  <TableHead>Piętro</TableHead>
                  <TableHead>Sektor</TableHead>
                  <TableHead className="text-center">Łóżka</TableHead>
                  <TableHead className="text-center">Obłożenie</TableHead>
                  <TableHead>Reguły alokacji</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map((room) => {
                  const genderInfo = getRoomGenderLabel(room)
                  const isGround = isGroundFloor(room.floor)
                  const isExpanded = expandedRooms[room.id]

                  return (
                    <TableRow
                      key={room.id}
                    >
                      <TableCell className="font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <DoorOpen className="w-4 h-4 text-primary" />
                          <span>Pokój {room.number}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{room.floor}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {room.sector ? `Sektor ${room.sector}` : '—'}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {room.beds || 0}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            room.free > 0
                              ? 'bg-muted text-foreground'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          {room.occupied || 0} / {room.beds || 0} ({room.free || 0} wolnych)
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          {isGround && (
                            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                              Parter
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                              genderInfo.variant === 'warning'
                                ? 'bg-muted text-foreground'
                                : 'bg-muted text-foreground'
                            }`}
                          >
                            {genderInfo.label}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <AddBedDialog roomId={room.id} onBedAdded={onUpdate} />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRoom(room.id)}
                            className="h-8 px-2 text-xs text-primary hover:text-primary"
                          >
                            {isExpanded ? 'Zwiń' : 'Łóżka'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
