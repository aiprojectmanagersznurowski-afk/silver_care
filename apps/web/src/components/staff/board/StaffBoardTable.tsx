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
import { formatPersonName, personSortKey } from '@/lib/person-name'
import { useTableSort } from '@/hooks/use-table-sort'
import { SortableTableHead } from '@/components/patterns/SortableTableHead'
import { ListPagination, usePagination } from '@/components/patterns/ListPagination'

interface StaffBoardTableProps {
  residents: Record<string, unknown>[]
  unansweredMessagesMap: Record<string, UnansweredInfo>
}

const actionLink =
  'inline-flex min-h-touch items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors'

const STAFF_BOARD_PAGE_SIZE = 50

type Row = Record<string, unknown>
const NOTE_ORDER = { none: 0, draft: 1, ready: 2 } as const
const roomOf = (r: Row) => ((getActiveAssignment(r)?.beds as Row | undefined)?.rooms as Row | undefined)?.number as string | undefined

/** Tablica dyżuru w widoku tabeli — te same informacje i akcje co karta podopiecznego. */
export function StaffBoardTable({ residents, unansweredMessagesMap }: StaffBoardTableProps) {
  const { sorted: sortedAll, sort, toggleSort } = useTableSort(
    residents,
    {
      name: (r: Row) => personSortKey(r.first_name as string, r.last_name as string),
      room: (r: Row) => roomOf(r) ?? null,
      note: (r: Row) => NOTE_ORDER[getNoteStatus(r)],
      // Najpierw wątki czekające na odpowiedź (sortowanie malejące)
      messages: (r: Row) => Boolean(unansweredMessagesMap[r.id as string]?.hasUnanswered),
    },
    { key: 'name', direction: 'asc' }
  )
  // Stronicowanie po sortowaniu całej listy (WO-NFR-PERF-SCREEN-LOAD, decyzja Michała 2026-10-30).
  // Zmiana zestawu po filtrach (liczba i pierwszy podopieczny) wraca na stronę 1.
  const pagination = usePagination(sortedAll.length, STAFF_BOARD_PAGE_SIZE, `${residents.length}:${String(residents[0]?.id ?? '')}`)
  const sorted = pagination.slice(sortedAll)

  return (
    <>
      <Table aria-label="Tablica dyżuru — podopieczni">
        <TableHeader className="text-muted-foreground">
          <TableRow>
            <SortableTableHead sortKey="name" sort={sort} onSort={toggleSort}>Podopieczny</SortableTableHead>
            <SortableTableHead sortKey="room" sort={sort} onSort={toggleSort}>Pokój i łóżko</SortableTableHead>
            <SortableTableHead sortKey="note" sort={sort} onSort={toggleSort}>Wpis dnia</SortableTableHead>
            <SortableTableHead sortKey="messages" sort={sort} onSort={toggleSort}>Wiadomości</SortableTableHead>
            <TableHead scope="col" className="text-right">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((resident) => {
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
                      {formatPersonName(resident.first_name as string, resident.last_name as string)}
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
      <ListPagination
        total={sortedAll.length}
        from={pagination.from}
        to={pagination.to}
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPrev={pagination.prev}
        onNext={pagination.next}
      />
    </>
  )
}
