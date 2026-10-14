'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { LayoutGrid, Table as TableIcon, UserCircle2, ChevronRight, Search } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { ResidentInlineCareLevel } from '@/components/ResidentInlineCareLevel'
import { ResidentZsnCheckbox } from '@/components/ResidentZsnCheckbox'
import { ResidentEditSheet } from '@/components/ResidentEditSheet'
import { ResidentMobileCard } from '@/components/ResidentMobileCard'
import { useViewPreference, VIEW_PREFERENCE_KEYS } from '@/hooks/use-view-preference'
import { type CareLevel } from '@/lib/reporting-constants'

interface BedAssignmentItem {
  id: string
  unassigned_at: string | null
  beds: {
    id: string
    label: string
    rooms: {
      number: string
    } | null
  } | null
}

export interface ResidentWithAssignments {
  id: string
  first_name: string
  last_name: string
  avatar_url?: string | null
  care_level?: CareLevel | null
  is_zsn?: boolean
  archived_at?: string | null
  death_date?: string | null
  admission_date?: string | null
  contract_end_date?: string | null
  contract_end_reason?: string | null
  created_at: string
  bed_assignments?: BedAssignmentItem[]
}

interface AdminResidentsClientProps {
  residents: ResidentWithAssignments[]
}

export function AdminResidentsClient({ residents }: AdminResidentsClientProps) {
  const [viewMode, setViewMode] = useViewPreference(
    VIEW_PREFERENCE_KEYS.residents,
    'table',
    ['grid', 'table'] as const
  )
  const [searchQuery, setSearchQuery] = useState('')

  const filteredResidents = (residents || []).filter((r) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const fullName = `${r.first_name} ${r.last_name}`.toLowerCase()
    return fullName.includes(q) || r.id.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      {/* Pasek narzędziowy: Wyszukiwarka + Przełącznik Kafelki / Tabela */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Szukaj podopiecznego..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl self-end sm:self-auto border border-border">
          <Button
            type="button"
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className={`h-8 px-3 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'grid' ? 'bg-primary text-white hover:bg-primary/90' : 'text-foreground'
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
            className={`h-8 px-3 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'table' ? 'bg-primary text-white hover:bg-primary/90' : 'text-foreground'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5 mr-1.5" />
            Tabela
          </Button>
        </div>
      </div>

      {filteredResidents.length === 0 ? (
        <div className="rounded-xl bg-card p-8 text-center text-muted-foreground border border-border">
          {searchQuery ? 'Brak podopiecznych pasujących do wyszukiwania.' : 'Brak podopiecznych w bazie.'}
        </div>
      ) : viewMode === 'grid' ? (
        /* Widok kafelkowy (Grid) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResidents.map((resident) => {
            const activeAssignments = Array.isArray(resident.bed_assignments)
              ? resident.bed_assignments.filter((a) => a.unassigned_at === null)
              : []
            const activeBed = activeAssignments.length > 0 ? activeAssignments[0].beds : null

            return (
              <Card key={resident.id} className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/admin/residents/${resident.id}`} className="flex items-center gap-3 min-w-0 group">
                      <Avatar className="h-11 w-11 border border-border shrink-0">
                        {resident.avatar_url && (
                          <AvatarImage src={resident.avatar_url} alt={`${resident.first_name} ${resident.last_name}`} />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <UserCircle2 className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors block truncate">
                          {resident.first_name} {resident.last_name}
                        </span>
                        <BusinessIdBadge type="resident" id={resident.id} />
                      </div>
                    </Link>

                    <div className="flex items-center gap-1 shrink-0">
                      <ResidentEditSheet resident={resident} />
                      <Link
                        href={`/admin/residents/${resident.id}`}
                        className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                        title="Profil 360°"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Poziom opieki</span>
                      <div className="mt-0.5">
                        <ResidentInlineCareLevel
                          residentId={resident.id}
                          initialCareLevel={resident.care_level ?? null}
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">ZSN</span>
                      <div className="mt-0.5">
                        <ResidentZsnCheckbox
                          residentId={resident.id}
                          initialValue={Boolean(resident.is_zsn)}
                          variant="compact"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                    <span className="text-muted-foreground">
                      {activeBed ? `Pok. ${activeBed.rooms?.number}, ł. ${activeBed.label}` : 'Brak przypisanego łóżka'}
                    </span>
                    <div>
                      {resident.archived_at ? (
                        <Badge className="bg-muted text-muted-foreground border-none text-[10px]">
                          Zarchiwizowany
                        </Badge>
                      ) : resident.death_date ? (
                        <Badge className="bg-destructive/10 text-destructive border-none text-[10px]">
                          Zgon
                        </Badge>
                      ) : resident.contract_end_date && new Date(resident.contract_end_date) <= new Date() ? (
                        <Badge className="bg-muted text-muted-foreground border-none text-[10px]">
                          Wypisany
                        </Badge>
                      ) : (
                        <Badge className="bg-primary/10 text-primary border-none text-[10px]">
                          Aktywny
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        /* Widok tabelaryczny (Table) */
        <>
          {/* Mobilny fallback dla małych ekranów */}
          <div className="block sm:hidden space-y-3">
            {filteredResidents.map((resident) => (
              <ResidentMobileCard key={resident.id} resident={resident} />
            ))}
          </div>

          {/* Pełna tabela na ekranach sm+ */}
          <Card className="hidden sm:block rounded-xl border border-border overflow-hidden">
            <CardContent className="p-0">
              <div className="relative w-full overflow-auto">
                <Table>
                  <TableHeader className="text-muted-foreground bg-muted/30">
                    <TableRow>
                      <TableHead>Imię i nazwisko</TableHead>
                      <TableHead>Stan</TableHead>
                      <TableHead>ZSN</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pokój</TableHead>
                      <TableHead>Data przyjęcia</TableHead>
                      <TableHead className="w-24 text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResidents.map((resident) => {
                      const activeAssignments = Array.isArray(resident.bed_assignments)
                        ? resident.bed_assignments.filter((a) => a.unassigned_at === null)
                        : []
                      const activeBed = activeAssignments.length > 0 ? activeAssignments[0].beds : null

                      return (
                        <TableRow key={resident.id} className="group hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <Link href={`/admin/residents/${resident.id}`} className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border border-border shrink-0">
                                {resident.avatar_url && (
                                  <AvatarImage src={resident.avatar_url} alt={`${resident.first_name} ${resident.last_name}`} />
                                )}
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  <UserCircle2 className="h-5 w-5" />
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <span className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                                  {resident.first_name} {resident.last_name}
                                </span>
                                <BusinessIdBadge type="resident" id={resident.id} />
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <ResidentInlineCareLevel
                              residentId={resident.id}
                              initialCareLevel={resident.care_level ?? null}
                            />
                          </TableCell>
                          <TableCell>
                            <ResidentZsnCheckbox
                              residentId={resident.id}
                              initialValue={Boolean(resident.is_zsn)}
                              variant="compact"
                            />
                          </TableCell>
                          <TableCell>
                            {resident.archived_at ? (
                              <Badge className="bg-muted text-muted-foreground border-none text-xs">
                                Zarchiwizowany
                              </Badge>
                            ) : resident.death_date ? (
                              <Badge className="bg-destructive/10 text-destructive border-none text-xs">
                                Zgon
                              </Badge>
                            ) : resident.contract_end_date && new Date(resident.contract_end_date) <= new Date() ? (
                              <Badge className="bg-muted text-muted-foreground border-none text-xs">
                                Wypisany
                              </Badge>
                            ) : (
                              <Badge className="bg-muted text-foreground border-none text-xs">
                                Aktywny
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {activeBed ? (
                              <span>
                                Pok. {activeBed.rooms?.number}, ł. {activeBed.label}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {resident.admission_date
                              ? format(new Date(resident.admission_date), 'd MMM yyyy', { locale: pl })
                              : resident.created_at
                                ? format(new Date(resident.created_at), 'd MMM yyyy', { locale: pl })
                                : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <ResidentEditSheet resident={resident} />
                              <Link
                                href={`/admin/residents/${resident.id}`}
                                className="p-2 text-muted-foreground/50 hover:text-primary transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                                title="Profil 360°"
                              >
                                <ChevronRight className="h-5 w-5" />
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
