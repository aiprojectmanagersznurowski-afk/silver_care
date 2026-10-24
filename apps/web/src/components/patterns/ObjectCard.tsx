import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'

interface ObjectCardProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Plakietki statusu (StatusBadge) pod tytułem. */
  badges?: ReactNode
  /** Dane obiektu jako pary etykieta — wartość. */
  meta?: { label: string; value: ReactNode }[]
  /** Akcje w stopce kafelka. */
  actions?: ReactNode
}

/**
 * Wspólny kafelek obiektu (ADR-017): ten sam układ w widoku kafelkowym każdej listy —
 * personel, zaproszenia, konta, łóżka, dni raportu.
 */
export function ObjectCard({ title, subtitle, badges, meta, actions }: ObjectCardProps) {
  return (
    <div data-slot="object-card" className="flex">
    <Card className="flex-1 gap-0 py-0">
      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {badges && (
          <div data-slot="object-card-badges" className="flex flex-wrap items-center gap-2">
            {badges}
          </div>
        )}
        {meta && meta.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {meta.map((m) => (
              <div key={m.label} className="contents">
                <dt className="text-muted-foreground">{m.label}</dt>
                <dd className="min-w-0 truncate text-foreground">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {actions && (
        <div data-slot="object-card-actions" className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/30 p-3">
          {actions}
        </div>
      )}
    </Card>
    </div>
  )
}

/** Siatka kafelków — jeden układ kolumn na każdym ekranie. */
export function ObjectGrid({ children }: { children: ReactNode }) {
  return (
    <div data-slot="object-grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  )
}
