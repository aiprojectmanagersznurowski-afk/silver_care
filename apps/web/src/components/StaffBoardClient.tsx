'use client'

import { useState, useMemo, useEffect, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Search, X, Mic, FileText, Bed, CheckCircle2, Zap, LayoutGrid, Loader2, MessageSquare } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MediaUploader } from '@/components/MediaUploader'
import { quickLogRoutineObservationAction } from '@/actions/bulk-reports'
import Link from 'next/link'
import { toast } from 'sonner'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

type NoteStatus = 'ready' | 'draft' | 'none'

function getNoteStatus(resident: Record<string, unknown>): NoteStatus {
  const reports = (resident.daily_reports || []) as Array<Record<string, string>>
  const drafts = (resident.voice_draft_notes || []) as Array<Record<string, string>>

  if (reports.some((r) => r.status === 'PUBLISHED')) return 'ready'
  if (drafts.some((d) => d.status === 'DRAFT') || reports.some((r) => r.status === 'DRAFT')) return 'draft'
  return 'none'
}

function getActiveAssignment(resident: Record<string, unknown>) {
  const assignments = (resident.bed_assignments || []) as Array<Record<string, unknown>>
  return assignments.find((a) => a.unassigned_at === null) as Record<string, unknown> | undefined
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
  return (rooms?.number as string) || null
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
  const [viewMode, setViewMode] = useState<'standard' | 'rounds'>('rounds')
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [floorFilter, setFloorFilter] = useState<string>('all')
  const [roomFilter, setRoomFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Śledzenie pensjonariuszy z potwierdzoną obserwacją 1-kliknięciem
  const [loggedResidentIds, setLoggedResidentIds] = useState<Record<string, boolean>>({})
  const [pendingResidentId, setPendingResidentId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

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
    return residents.filter((r) => {
      const name = `${r.first_name} ${r.last_name}`.toLowerCase()
      if (searchFilter.trim() !== '' && !name.includes(searchFilter.toLowerCase().trim())) {
        return false
      }
      if (floorFilter !== 'all' && getFloorLabel(r) !== floorFilter) {
        return false
      }
      if (roomFilter !== 'all' && getRoomNumber(r) !== roomFilter) {
        return false
      }
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
    (searchFilter !== '' ? 1 : 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-semibold tracking-tight text-slate">
            Podopieczni
          </h2>
          <p className="mt-1 text-slate-soft text-sm">
            Szybki obchód dyżurny, bezpośrednie dyktowanie i bieżący stan podopiecznych.
          </p>
        </div>

        {/* Przełącznik trybu widoku */}
        <div className="flex items-center gap-2">
          <div className="bg-slate/5 p-1 rounded-xl flex items-center border border-slate/10">
            <button
              type="button"
              onClick={() => setViewMode('rounds')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[40px] ${
                viewMode === 'rounds'
                  ? 'bg-sage text-white shadow-xs'
                  : 'text-slate-soft hover:text-slate'
              }`}
            >
              <Zap className="h-4 w-4" />
              Szybki obchód (Quick-Rounds)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('standard')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[40px] ${
                viewMode === 'standard'
                  ? 'bg-white text-slate shadow-xs'
                  : 'text-slate-soft hover:text-slate'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Karty
            </button>
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate/5 px-3 py-2 text-xs font-semibold text-slate-soft hover:bg-slate/10 hover:text-slate transition-colors min-h-[40px]"
            >
              Wyczyść ({activeFiltersCount})
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Pasek filtrów tokenowych (filter-token-bar) */}
      <Card data-testid="filter-token-bar" className="rounded-2xl border-none shadow-sm ring-1 ring-slate/10 bg-white">
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Górny wiersz: Wyszukiwarka + Licznik */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-soft" />
              <input
                placeholder="Szukaj podopiecznego..."
                className="w-full h-10 pl-10 pr-9 rounded-xl border border-slate/15 bg-slate/5 text-sm text-slate placeholder:text-slate-soft focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent transition-all"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-soft hover:text-slate p-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="text-xs font-medium text-slate-soft self-end sm:self-center">
              Wyników: <span className="font-semibold text-slate">{filtered.length}</span> z {residents.length}
            </div>
          </div>

          {/* Rzędy tokenów filtrów */}
          <div className="space-y-2.5 pt-1 border-t border-slate/10">
            {/* Tokeny statusu notatki */}
            <div data-filter-group="status" className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-soft w-14 shrink-0">Status:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-slate text-white'
                    : 'bg-slate/5 text-slate-soft hover:bg-slate/10 hover:text-slate'
                }`}
              >
                Wszystkie
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('none')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'none'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20 hover:bg-rose-100'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                Brak wpisu
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('draft')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'draft'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 hover:bg-amber-100'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                Wersja robocza
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ready')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'ready'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                Raport gotowy
              </button>
            </div>

            {/* Tokeny piętra */}
            {floors.length > 0 && (
              <div data-filter-group="floor" className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-soft w-14 shrink-0">Piętro:</span>
                <button
                  type="button"
                  onClick={() => setFloorFilter('all')}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    floorFilter === 'all'
                      ? 'bg-slate text-white'
                      : 'bg-slate/5 text-slate-soft hover:bg-slate/10 hover:text-slate'
                  }`}
                >
                  Wszystkie
                </button>
                {floors.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFloorFilter(f)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      floorFilter === f
                        ? 'bg-slate text-white'
                        : 'bg-slate/5 text-slate-soft hover:bg-slate/10 hover:text-slate'
                    }`}
                  >
                    Piętro {f}
                  </button>
                ))}
              </div>
            )}

            {/* Tokeny sali (gdy wybrane piętro) */}
            {floorFilter !== 'all' && roomsForCurrentFloor.length > 0 && (
              <div data-filter-group="room" className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-soft w-14 shrink-0">Sala:</span>
                <button
                  type="button"
                  onClick={() => setRoomFilter('all')}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    roomFilter === 'all'
                      ? 'bg-slate text-white'
                      : 'bg-slate/5 text-slate-soft hover:bg-slate/10 hover:text-slate'
                  }`}
                >
                  Wszystkie
                </button>
                {roomsForCurrentFloor.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoomFilter(r)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      roomFilter === r
                        ? 'bg-slate text-white'
                        : 'bg-slate/5 text-slate-soft hover:bg-slate/10 hover:text-slate'
                    }`}
                  >
                    Pokój {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Aktywne tokeny filtrów (Active chips) */}
          {activeFiltersCount > 0 && (
            <div className="pt-2 border-t border-slate/10 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-soft uppercase tracking-wider">
                Aktywne filtry:
              </span>
              {searchFilter && (
                <span className="inline-flex items-center gap-1 bg-sage/10 text-sage-dark text-xs font-medium px-2.5 py-0.5 rounded-full">
                  Szukaj: &quot;{searchFilter}&quot;
                  <button type="button" onClick={() => setSearchFilter('')} className="hover:opacity-75">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-slate/10 text-slate text-xs font-medium px-2.5 py-0.5 rounded-full">
                  Status: {STATUS_CONFIG[statusFilter as NoteStatus]?.label}
                  <button type="button" onClick={() => setStatusFilter('all')} className="hover:opacity-75">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {floorFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-slate/10 text-slate text-xs font-medium px-2.5 py-0.5 rounded-full">
                  Piętro: {floorFilter}
                  <button type="button" onClick={() => setFloorFilter('all')} className="hover:opacity-75">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {roomFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-slate/10 text-slate text-xs font-medium px-2.5 py-0.5 rounded-full">
                  Pokój: {roomFilter}
                  <button type="button" onClick={() => setRoomFilter('all')} className="hover:opacity-75">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tryb Szybkiego Obchodu (Quick-Rounds Mode) */}
      {viewMode === 'rounds' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((resident) => {
            const resId = resident.id as string
            const active = getActiveAssignment(resident)
            const beds = active?.beds as Record<string, unknown> | undefined
            const rooms = beds?.rooms as Record<string, unknown> | undefined
            const bedLabel = beds?.label as string | undefined
            const roomNumber = rooms?.number as string | undefined
            const isLogged = Boolean(loggedResidentIds[resId])
            const isSubmitting = pendingResidentId === resId

            return (
              <div
                key={resId}
                className="bg-white rounded-2xl border border-slate/10 p-5 shadow-sm space-y-4 hover:border-sage/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border border-slate/10">
                      {(resident.avatar_url as string) && (
                        <AvatarImage
                          src={resident.avatar_url as string}
                          alt={`${resident.first_name as string} ${resident.last_name as string}`}
                        />
                      )}
                      <AvatarFallback className="bg-sage/10 text-sage-dark font-semibold text-base">
                        {(resident.first_name as string)?.[0]}
                        {(resident.last_name as string)?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-semibold text-slate text-base">
                        {resident.first_name as string} {resident.last_name as string}
                      </h4>
                      <p className="text-xs text-slate-soft flex items-center gap-1 mt-0.5">
                        <Bed className="h-3.5 w-3.5" />
                        {roomNumber && bedLabel
                          ? `Pokój ${roomNumber}, Łóżko ${bedLabel}`
                          : 'Brak przypisanego łóżka'}
                      </p>
                    </div>
                  </div>

                  {isLogged && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Odnotowano
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href={`/voice?resident=${resId}`} className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-sage px-3 py-3 text-xs font-semibold text-white shadow-xs hover:bg-sage-dark transition-colors min-h-[48px]">
                        <Mic className="h-4 w-4" />
                        Dyktuj (1-klik)
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      Nagraj notatkę głosową dla tego pensjonariusza
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <button
                          type="button"
                          onClick={() => handleQuickLog(resId)}
                          disabled={isSubmitting || isLogged}
                          className={`w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-xs font-semibold transition-colors min-h-[48px] ${
                            isLogged
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                              : 'bg-white border border-slate/20 text-slate hover:bg-slate/5 shadow-xs'
                          }`}
                        >
                          {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin text-sage" />
                          ) : isLogged ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              Stabilny
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-slate-soft" />
                              Stan stabilny
                            </>
                          )}
                        </button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isLogged
                        ? 'Obserwacja została już zarejestrowana podczas tego obchodu'
                        : 'Zapisz rutynową obserwację: Stan stabilny, bez uwag'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Standardowy widok kart */
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
              <Card
                key={resident.id as string}
                className="group relative overflow-hidden rounded-2xl border-none shadow-sm ring-1 ring-slate/5 bg-white transition-all hover:shadow-md hover:ring-sage/30 flex flex-col"
              >
                <CardContent className="p-0 flex flex-col h-full">
                  <div className="p-5 flex-grow space-y-4">
                    <div className="flex items-start justify-between">
                      <Avatar className="h-12 w-12 border border-slate/10 shadow-sm">
                        {(resident.avatar_url as string) && (
                          <AvatarImage
                            src={resident.avatar_url as string}
                            alt={`${resident.first_name as string} ${resident.last_name as string}`}
                          />
                        )}
                        <AvatarFallback className="bg-sage/10 text-sage-dark font-semibold">
                          {(resident.first_name as string)?.[0]}
                          {(resident.last_name as string)?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusCfg.className}`}
                      >
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
                          <span>
                            Pokój {roomNumber}, Łóżko {bedLabel}
                          </span>
                        ) : (
                          <span className="text-rose-500">Brak przypisanego łóżka</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate/5 p-4 bg-slate/5 flex flex-col gap-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={`/voice?resident=${resident.id}`} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sage-dark transition-colors min-h-[44px]">
                          <Mic className="h-4 w-4" />
                          Nagraj notatkę
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        Otwórz potok głosowy i nagraj obserwację dla pensjonariusza
                      </TooltipContent>
                    </Tooltip>

                    {noteStatus !== 'none' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link href={`/staff/reports?resident=${resident.id}`} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate shadow-sm ring-1 ring-inset ring-slate/10 hover:bg-slate/5 transition-colors min-h-[44px]">
                            <FileText className="h-4 w-4 text-slate-soft" />
                            Podgląd raportu
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                          Zobacz wygenerowany raport i historię obserwacji
                        </TooltipContent>
                      </Tooltip>
                    )}

                    <Link href={`/staff/messages?residentId=${resident.id}`} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate shadow-sm ring-1 ring-inset ring-slate/10 hover:bg-slate/5 transition-colors min-h-[44px]">
                      <MessageSquare className="h-4 w-4 text-sage-dark" />
                      Wiadomości od rodziny
                    </Link>

                    <div className="mt-1">
                      <MediaUploader residentId={resident.id as string} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="col-span-full py-16 text-center rounded-2xl border border-dashed border-slate/20 bg-slate/5">
          <h3 className="text-sm font-medium text-slate mb-1">Brak podopiecznych</h3>
          <p className="text-sm text-slate-soft">Nie znaleziono osób spełniających kryteria wyszukiwania.</p>
          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="mt-6 inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate shadow-sm ring-1 ring-inset ring-slate/10 hover:bg-slate/5 transition-colors min-h-[44px]"
            >
              Wyczyść wszystkie filtry
            </button>
          )}
        </div>
      )}
    </div>
  )
}
