'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { UserCircle2, ChevronRight } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/patterns/TableCard'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { ResidentInlineCareLevel } from '@/components/ResidentInlineCareLevel'
import { ResidentZsnCheckbox } from '@/components/ResidentZsnCheckbox'
import { ResidentEditSheet } from '@/components/ResidentEditSheet'
import { ResidentMobileCard } from '@/components/ResidentMobileCard'
import { ResidentStatusBadge } from './ResidentStatusBadge'
import { getActiveBed, type ResidentWithAssignments } from './resident-list-types'

function admissionLabel(resident: ResidentWithAssignments): string {
  const date = resident.admission_date ?? resident.created_at
  return date ? format(new Date(date), 'd MMM yyyy', { locale: pl }) : '—'
}

export function ResidentsTable({ residents }: { residents: ResidentWithAssignments[] }) {
  return (
    <>
      {/* Mobilny fallback dla małych ekranów */}
      <div className="block sm:hidden space-y-3">
        {residents.map((resident) => (
          <ResidentMobileCard key={resident.id} resident={resident} />
        ))}
      </div>

      {/* Pełna tabela na ekranach sm+ */}
      <TableCard className="hidden sm:block">
            <Table>
              <TableHeader className="text-muted-foreground bg-muted/30">
                <TableRow>
                  <TableHead>Imię i nazwisko</TableHead>
                  <TableHead>Stan</TableHead>
                  <TableHead>ZSN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pokój</TableHead>
                  <TableHead>Data przyjęcia</TableHead>
                  <TableHead className="w-28 text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {residents.map((resident) => {
                  const activeBed = getActiveBed(resident)
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
                        <ResidentInlineCareLevel residentId={resident.id} initialCareLevel={resident.care_level ?? null} />
                      </TableCell>
                      <TableCell>
                        <ResidentZsnCheckbox residentId={resident.id} initialValue={Boolean(resident.is_zsn)} variant="compact" />
                      </TableCell>
                      <TableCell>
                        <ResidentStatusBadge resident={resident} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {activeBed ? (
                          <span>Pok. {activeBed.rooms?.number}, ł. {activeBed.label}</span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{admissionLabel(resident)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ResidentEditSheet resident={resident} />
                          <Link
                            href={`/admin/residents/${resident.id}`}
                            className="p-2 text-muted-foreground/50 hover:text-primary transition-colors min-h-touch min-w-touch inline-flex items-center justify-center"
                            title="Profil 360°"
                            aria-label="Profil 360°"
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
      </TableCard>
    </>
  )
}
