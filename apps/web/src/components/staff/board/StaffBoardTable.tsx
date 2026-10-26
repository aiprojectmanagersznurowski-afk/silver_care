'use client'

import React from 'react'
import Link from 'next/link'
import { Mic, FileText, MessageSquare } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { TableStateRow } from '@/components/patterns/TableCard'
import { RowActions } from '@/components/patterns/RowActions'
import { getActiveAssignment, getNoteStatus, STATUS_CONFIG, UnansweredInfo } from './staff-board-types'

interface StaffBoardTableProps {
  residents: Record<string, unknown>[]
  unansweredMessagesMap: Record<string, UnansweredInfo>
}

const actionLink =
  'inline-flex min-h-touch items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors'

/** Tablica dyżuru w widoku tabeli — te same informacje i akcje co karta podopiecznego. */
export function StaffBoardTable({ residents, unansweredMessagesMap }: StaffBoardTableProps) {
  return (
    <Table aria-label="Tablica dyżuru — podopieczni">
        <TableHeader className="text-muted-foreground">
          <TableRow>
            <TableHead scope="col">Podopieczny</TableHead>
            <TableHead scope="col">Pokój i łóżko</TableHead>
            <TableHead scope="col">Wpis dnia</TableHead>
            <TableHead scope="col">Wiadomości</TableHead>
            <TableHead scope="col" className="text-right">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {residents.map((resident) => {
            const resId = resident.id as string
            const beds = getActiveAssignment(resident)?.beds as Record<string, unknown> | undefined
            const roomNumber = (beds?.rooms as Record<string, unknown> | undefined)?.number as string | undefined
            const bedLabel = beds?.label as string | undefined
            const noteStatus = getNoteStatus(resident)
            const unanswered = unansweredMessagesMap[resId]
            return (
              <TableRow key={resId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link href={`/staff/residents/${resId}`} className="font-medium text-foreground hover:text-primary hover:underline">
                      {resident.first_name as string} {resident.last_name as string}
                    </Link>
                    <BusinessIdBadge type="resident" id={resId} />
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {roomNumber && bedLabel ? `Pokój ${roomNumber}, Łóżko ${bedLabel}` : 'Brak przypisanego łóżka'}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={noteStatus === 'ready' ? 'brand' : 'neutral'}>{STATUS_CONFIG[noteStatus].label}</StatusBadge>
                </TableCell>
                <TableCell>
                  {unanswered?.hasUnanswered ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone="brand" data-testid="unanswered-message-badge">
                        <MessageSquare />
                        Nowa wiadomość od rodziny
                      </StatusBadge>
                      <Link href={`/admin/messages?residentId=${resId}`} className={`${actionLink} text-primary hover:underline`}>
                        Odpowiedz &rarr;
                      </Link>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/voice?resident=${resId}`}
                      className={buttonVariants({ variant: 'default' })}
                    >
                      <Mic className="size-4" />
                      Nagraj notatkę
                    </Link>
                    <RowActions
                      label="Podopieczny"
                      actions={[{
                        label: 'Podgląd raportu',
                        icon: FileText,
                        href: `/staff/reports?resident=${resId}`,
                        disabled: noteStatus === 'none',
                        hint: noteStatus === 'none' ? 'Brak wpisu na dziś' : undefined,
                      }]}
                    />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {residents.length === 0 && (
            <TableStateRow colSpan={5} state="empty" title="Brak podopiecznych" description="Żaden podopieczny nie spełnia wybranych filtrów." />
          )}
        </TableBody>
      </Table>
  )
}
