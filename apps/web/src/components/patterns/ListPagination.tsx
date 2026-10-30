'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildPaginationMeta, getPaginationRange } from '@/lib/pagination'

/**
 * Stronicowanie listy po stronie klienta (WO-NFR-PERF-SCREEN-LOAD, decyzja Michała 2026-10-30).
 * Strona to wycinek listy już przefiltrowanej i posortowanej; zmiana `resetKey` (np. fraza wyszukiwania)
 * wraca na stronę 1. Renderowana jest tylko bieżąca strona — mniej HTML i elementów DOM.
 */
export function usePagination(total: number, pageSize: number, resetKey: unknown = null) {
  // Strona zapamiętana razem z kluczem — inny klucz (nowa fraza, inny widok) oznacza stronę 1, bez efektu
  const [state, setState] = useState<{ page: number; key: unknown }>({ page: 1, key: resetKey })
  const page = Object.is(state.key, resetKey) ? state.page : 1

  const meta = buildPaginationMeta(total, { page, limit: pageSize })
  const current = Math.min(page, meta.totalPages)
  const { from, to } = getPaginationRange({ page: current, limit: pageSize })
  const goTo = (target: number) => setState({ page: Math.min(Math.max(target, 1), meta.totalPages), key: resetKey })

  return {
    page: current,
    totalPages: meta.totalPages,
    from,
    to: Math.min(to, total - 1),
    slice: <T,>(items: T[]) => items.slice(from, from + pageSize),
    next: () => goTo(current + 1),
    prev: () => goTo(current - 1),
  }
}

interface ListPaginationProps {
  total: number
  from: number
  to: number
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

export function ListPagination({ total, from, to, page, totalPages, onPrev, onNext }: ListPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Stronicowanie listy" className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
      <span data-testid="list-pagination-summary">
        {from + 1}–{to + 1} z {total}
      </span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="min-h-touch" onClick={onPrev} disabled={page <= 1} aria-label="Poprzednia strona">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span aria-live="polite">Strona {page} z {totalPages}</span>
        <Button type="button" variant="outline" size="sm" className="min-h-touch" onClick={onNext} disabled={page >= totalPages} aria-label="Następna strona">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  )
}
