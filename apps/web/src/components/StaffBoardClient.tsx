'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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
  const [floorFilter, setFloorFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    if (floorFilter === 'all') return residents
    return residents.filter(r => getFloorLabel(r) === floorFilter)
  }, [residents, floorFilter])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Tablica Pensjonariuszy
        </h2>
        <p className="text-text-secondary">Status notatek dziennych, filtrowanie po piętrze.</p>
      </div>

      {/* Floor filter */}
      {floors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFloorFilter('all')}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
              floorFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Wszystkie piętra
          </button>
          {floors.map(f => (
            <button
              key={f}
              onClick={() => setFloorFilter(f)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                floorFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

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
              <CardFooter className="pt-2">
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
              </CardFooter>
            </Card>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <h3 className="text-sm font-medium text-foreground mb-1">Brak pensjonariuszy</h3>
            <p className="text-sm text-text-secondary">
              {floorFilter !== 'all' ? 'Brak pensjonariuszy na wybranym piętrze.' : 'Poproś administratora placówki o dodanie podopiecznych do systemu.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
