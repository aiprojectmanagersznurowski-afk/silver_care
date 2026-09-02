'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AgendaView } from '@/components/AgendaView'
import { Search, X } from 'lucide-react'

type NoteStatus = 'ready' | 'draft' | 'none'

function getNoteStatus(resident: Record<string, unknown>): NoteStatus {
  const reports = (resident.daily_reports || []) as Array<Record<string, string>>
  const drafts = (resident.voice_draft_notes || []) as Array<Record<string, string>>

  if (reports.some(r => r.status === 'PUBLISHED')) return 'ready'
  if (drafts.some(d => d.status === 'DRAFT') || reports.some(r => r.status === 'DRAFT')) return 'draft'
  return 'none'
}

function getActiveAssignment(resident: Record<string, unknown>) {
  const assignments = (resident.bed_assignments || []) as Array<Record<string, unknown>>
  return assignments.find(a => a.unassigned_at === null) as Record<string, unknown> | undefined
}

function getFloorLabel(resident: Record<string, unknown>): string | null {
  const active = getActiveAssignment(resident)
  if (!active) return null
  const beds = active.beds as Record<string, unknown> | undefined
  const rooms = beds?.rooms as Record<string, unknown> | undefined
  const floors = rooms?.floors as Record<string, string> | undefined
  return floors?.label || null
}

function getRoomNumber(resident: Record<string, unknown>): string | null {
  const active = getActiveAssignment(resident)
  if (!active) return null
  const beds = active.beds as Record<string, unknown> | undefined
  const rooms = beds?.rooms as Record<string, unknown> | undefined
  return rooms?.number as string | null
}

const STATUS_CONFIG: Record<NoteStatus, { label: string; className: string }> = {
  ready: { label: 'Raport gotowy', className: 'bg-green-100 text-green-800' },
  draft: { label: 'Wersja robocza', className: 'bg-yellow-100 text-yellow-800' },
  none: { label: 'Brak wpisu', className: 'bg-red-100 text-red-800' },
}

interface StaffBoardClientProps {
  residents: Record<string, unknown>[]
  floors: string[]
}

export function StaffBoardClient({ residents, floors }: StaffBoardClientProps) {
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [floorFilter, setFloorFilter] = useState<string>('all')
  const [roomFilter, setRoomFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Zabezpieczenie przed trzymaniem przestarzałego pokoju jak user zmienia piętro
  useEffect(() => {
    setRoomFilter('all')
  }, [floorFilter])

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
    return residents.filter(r => {
      // Wyszukiwarka imię / nazwisko
      const name = `${r.first_name} ${r.last_name}`.toLowerCase()
      if (searchFilter.trim() !== '' && !name.includes(searchFilter.toLowerCase().trim())) {
        return false
      }
      
      // Filtr piętra
      if (floorFilter !== 'all' && getFloorLabel(r) !== floorFilter) {
        return false
      }
      
      // Filtr pokoju
      if (roomFilter !== 'all' && getRoomNumber(r) !== roomFilter) {
        return false
      }

      // Filtr statusu raportu
      if (statusFilter !== 'all' && getNoteStatus(r) !== statusFilter) {
        return false
      }

      return true
    })
  }, [residents, searchFilter, floorFilter, roomFilter, statusFilter])

  const clearFilters = () => {
    setSearchFilter('')
    setFloorFilter('all')
    setRoomFilter('all')
    setStatusFilter('all')
  }

  const activeFiltersCount = (floorFilter !== 'all' ? 1 : 0) + (roomFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (searchFilter !== '' ? 1 : 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Tablica Pensjonariuszy
          </h2>
          <p className="text-text-secondary">Status notatek dziennych, filtrowanie po piętrze, sali i wpisach.</p>
        </div>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground h-8 px-2 lg:px-3">
            Wyczyść filtry ({activeFiltersCount})
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      <AgendaView residents={residents} />

      <Card className="p-4 bg-surface-sunken border-none space-y-4">
        {/* Szukajka */}
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Szukaj pensjonariusza..." 
            className="pl-9 bg-background" 
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>

        {/* Filtr pięter */}
        {floors.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs uppercase font-medium text-muted-foreground mr-2">Piętro:</span>
            <button
              onClick={() => setFloorFilter('all')}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                floorFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground border hover:bg-muted/80'
              }`}
            >
              Wszystkie
            </button>
            {floors.map(f => (
              <button
                key={f}
                onClick={() => setFloorFilter(f)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                  floorFilter === f ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground border hover:bg-muted/80'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Filtr pokoi */}
        {floorFilter !== 'all' && roomsForCurrentFloor.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs uppercase font-medium text-muted-foreground mr-2">Sala:</span>
            <button
              onClick={() => setRoomFilter('all')}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                roomFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground border hover:bg-muted/80'
              }`}
            >
              Wszystkie
            </button>
            {roomsForCurrentFloor.map(r => (
              <button
                key={r}
                onClick={() => setRoomFilter(r)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                  roomFilter === r ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground border hover:bg-muted/80'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Filtr Statusów */}
        <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs uppercase font-medium text-muted-foreground mr-2">Status:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                statusFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground border hover:bg-muted/80'
              }`}
            >
              Wszystkie
            </button>
            <button
              onClick={() => setStatusFilter('none')}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                statusFilter === 'none' ? 'bg-red-500 text-white' : 'bg-background text-red-600 border border-red-200 hover:bg-red-50'
              }`}
            >
              Brak wpisu
            </button>
            <button
              onClick={() => setStatusFilter('draft')}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                statusFilter === 'draft' ? 'bg-yellow-500 text-white' : 'bg-background text-yellow-600 border border-yellow-200 hover:bg-yellow-50'
              }`}
            >
              Wersja robocza
            </button>
            <button
              onClick={() => setStatusFilter('ready')}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                statusFilter === 'ready' ? 'bg-green-500 text-white' : 'bg-background text-green-600 border border-green-200 hover:bg-green-50'
              }`}
            >
              Raport gotowy
            </button>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((resident) => {
          const active = getActiveAssignment(resident)
          const beds = active?.beds as Record<string, unknown> | undefined
          const rooms = beds?.rooms as Record<string, unknown> | undefined
          const bedLabel = beds?.label as string | undefined
          const roomNumber = rooms?.number as string | undefined
          const noteStatus = getNoteStatus(resident)
          const statusCfg = STATUS_CONFIG[noteStatus]

          return (
            <Card key={resident.id as string} className="group hover:border-primary/40 transition-colors flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                      {(resident.first_name as string)?.[0]}{(resident.last_name as string)?.[0]}
                    </span>
                    <span className="truncate">{resident.first_name as string} {resident.last_name as string}</span>
                  </div>
                </CardTitle>
                <div className="text-sm text-text-tertiary mt-1">
                  {roomNumber && bedLabel ? (
                    <span className="inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-medium">
                      Pokój {roomNumber}, Łóżko {bedLabel}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2.5 py-0.5 text-xs font-medium">
                      Brak przypisanego łóżka
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 flex-grow">
                <div className="text-sm">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusCfg.className}`}>
                    {statusCfg.label}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="pt-2 flex flex-col gap-2">
                <a href={`/voice?resident=${resident.id}`} className="block w-full">
                  <Button className="w-full" variant="outline">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" x2="12" y1="19" y2="22"/>
                    </svg>
                    Nagranie głosowe
                  </Button>
                </a>
                
                {/* Opcja podglądu raportu jeśli istnieje */}
                {noteStatus !== 'none' && (
                  <a href={`/reports?resident=${resident.id}`} className="block w-full">
                     <Button className="w-full text-xs h-8" variant="ghost">
                        Podgląd notatek
                     </Button>
                  </a>
                )}
              </CardFooter>
            </Card>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center bg-surface-sunken rounded-lg border border-dashed">
            <h3 className="text-sm font-medium text-foreground mb-1">Brak pensjonariuszy</h3>
            <p className="text-sm text-text-secondary">
              Spróbuj zmienić parametry filtrów albo wyczyścić je wszystkie.
            </p>
            {activeFiltersCount > 0 && (
              <Button onClick={clearFilters} variant="outline" className="mt-4">
                 Wyczyść filtry
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
