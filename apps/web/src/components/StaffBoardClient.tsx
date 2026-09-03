'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Search, X, Mic, FileText, Bed } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MediaUploader } from '@/components/MediaUploader'
import { AgendaView } from '@/components/AgendaView'
import Link from 'next/link'

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
  return (rooms?.floor as string) || null
}

function getRoomNumber(resident: Record<string, unknown>): string | null {
  const active = getActiveAssignment(resident)
  if (!active) return null
  const beds = active.beds as Record<string, unknown> | undefined
  const rooms = beds?.rooms as Record<string, unknown> | undefined
  return rooms?.number as string | null
}

const STATUS_CONFIG: Record<NoteStatus, { label: string; className: string }> = {
  ready: { label: 'Raport gotowy', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  draft: { label: 'Wersja robocza', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  none: { label: 'Brak wpisu', className: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-semibold tracking-tight text-slate">
            Podopieczni
          </h2>
          <p className="mt-2 text-slate-soft">Szybki dostęp do notatek i statusów.</p>
        </div>
        {activeFiltersCount > 0 && (
          <button 
            onClick={clearFilters}
            className="inline-flex items-center gap-2 rounded-xl bg-slate/5 px-3 py-2 text-sm font-medium text-slate-soft hover:bg-slate/10 hover:text-slate transition-colors"
          >
            Wyczyść filtry ({activeFiltersCount})
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Agenda View */}
      <AgendaView residents={residents} />

      {/* Filtry */}
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5 bg-white">
        <CardContent className="p-6 space-y-6">
          {/* Szukajka */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-soft" />
            <input 
              placeholder="Szukaj podopiecznego..." 
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate/10 bg-slate/5 text-slate placeholder:text-slate-soft focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent transition-all"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-4">
            {/* Filtr pięter */}
            {floors.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-soft w-16">Piętro:</span>
                <button
                  onClick={() => setFloorFilter('all')}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    floorFilter === 'all' ? 'bg-slate text-white' : 'bg-slate/5 text-slate-soft hover:bg-slate/10 hover:text-slate'
                  }`}
                >
                  Wszystkie
                </button>
                {floors.map(f => (
                  <button
                    key={f}
                    onClick={() => setFloorFilter(f)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      floorFilter === f ? 'bg-slate text-white' : 'bg-slate/5 text-slate-soft hover:bg-slate/10 hover:text-slate'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}

            {/* Filtr pokoi */}
            {floorFilter !== 'all' && roomsForCurrentFloor.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-soft w-16">Sala:</span>
                <button
                  onClick={() => setRoomFilter('all')}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    roomFilter === 'all' ? 'bg-slate text-white' : 'bg-slate/5 text-slate-soft hover:bg-slate/10 hover:text-slate'
                  }`}
                >
                  Wszystkie
                </button>
                {roomsForCurrentFloor.map(r => (
                  <button
                    key={r}
                    onClick={() => setRoomFilter(r)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      roomFilter === r ? 'bg-slate text-white' : 'bg-slate/5 text-slate-soft hover:bg-slate/10 hover:text-slate'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            {/* Filtr Statusów */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-soft w-16">Status:</span>
              <button
                onClick={() => setStatusFilter('all')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === 'all' ? 'bg-slate text-white' : 'bg-slate/5 text-slate-soft hover:bg-slate/10 hover:text-slate'
                }`}
              >
                Wszystkie
              </button>
              <button
                onClick={() => setStatusFilter('none')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === 'none' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20 hover:bg-rose-100'
                }`}
              >
                Brak wpisu
              </button>
              <button
                onClick={() => setStatusFilter('draft')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === 'draft' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 hover:bg-amber-100'
                }`}
              >
                Wersja robocza
              </button>
              <button
                onClick={() => setStatusFilter('ready')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === 'ready' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100'
                }`}
              >
                Raport gotowy
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista Podopiecznych */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((resident) => {
          const active = getActiveAssignment(resident)
          const beds = active?.beds as Record<string, unknown> | undefined
          const rooms = beds?.rooms as Record<string, unknown> | undefined
          const bedLabel = beds?.label as string | undefined
          const roomNumber = rooms?.number as string | undefined
          const noteStatus = getNoteStatus(resident)
          const statusCfg = STATUS_CONFIG[noteStatus]

          return (
            <Card key={resident.id as string} className="group relative overflow-hidden rounded-2xl border-none shadow-sm ring-1 ring-slate/5 bg-white transition-all hover:shadow-md hover:ring-sage/30 flex flex-col">
              <CardContent className="p-0 flex flex-col h-full">
                <div className="p-5 flex-grow space-y-4">
                  <div className="flex items-start justify-between">
                    <Avatar className="h-12 w-12 border border-slate/10 shadow-sm">
                      {(resident.avatar_url as string) && (
                        <AvatarImage src={resident.avatar_url as string} alt={`${resident.first_name as string} ${resident.last_name as string}`} />
                      )}
                      <AvatarFallback className="bg-sage/10 text-sage-dark font-semibold">
                        {(resident.first_name as string)?.[0]}{(resident.last_name as string)?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusCfg.className}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-slate truncate">
                      {resident.first_name as string} {resident.last_name as string}
                    </h3>
                    <div className="mt-1 flex items-center text-sm text-slate-soft">
                      <Bed className="h-4 w-4 mr-1.5 shrink-0" />
                      {roomNumber && bedLabel ? (
                        <span>Pokój {roomNumber}, Łóżko {bedLabel}</span>
                      ) : (
                        <span className="text-rose-500">Brak przypisanego łóżka</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate/5 p-4 bg-slate/5 flex flex-col gap-3">
                  <Link href={`/staff/voice?resident=${resident.id}`} className="block w-full">
                    <button className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sage-dark transition-colors">
                      <Mic className="h-4 w-4" />
                      Nagraj notatkę
                    </button>
                  </Link>
                  
                  {noteStatus !== 'none' && (
                    <Link href={`/staff/reports?resident=${resident.id}`} className="block w-full">
                       <button className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate shadow-sm ring-1 ring-inset ring-slate/10 hover:bg-slate/5 transition-colors">
                         <FileText className="h-4 w-4 text-slate-soft" />
                         Podgląd raportu
                       </button>
                    </Link>
                  )}
                  
                  {/* Media uploader */}
                  <div className="mt-1">
                    <MediaUploader residentId={resident.id as string} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center rounded-2xl border border-dashed border-slate/20 bg-slate/5">
            <h3 className="text-sm font-medium text-slate mb-1">Brak podopiecznych</h3>
            <p className="text-sm text-slate-soft">
              Nie znaleziono osób spełniających kryteria wyszukiwania.
            </p>
            {activeFiltersCount > 0 && (
              <button 
                onClick={clearFilters} 
                className="mt-6 inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate shadow-sm ring-1 ring-inset ring-slate/10 hover:bg-slate/5 transition-colors"
              >
                 Wyczyść wszystkie filtry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
