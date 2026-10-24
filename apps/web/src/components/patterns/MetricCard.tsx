import type { ReactNode } from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface MetricCardProps {
  icon: ReactNode
  label: string
  value: ReactNode
  description?: ReactNode
}

/**
 * Karta wskaźnika placówki w układzie szablonu shadcn-admin: kafel ikony, etykieta, wartość, opis.
 * Bez gradientu i bez plakietki trendu — wskaźnik jest faktem, nie oceną (ADR-005, ADR-019).
 */
export function MetricCard({ icon, label, value, description }: MetricCardProps) {
  return (
    <div data-slot="metric-card" className="flex">
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>
            <div
              data-slot="metric-icon"
              className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground [&>svg]:size-4"
            >
              {icon}
            </div>
          </CardTitle>
          <CardDescription>{label}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div data-slot="metric-value" className="text-3xl font-medium tabular-nums leading-none tracking-tight">{value}</div>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </CardContent>
      </Card>
    </div>
  )
}

/** Siatka kart wskaźników — jak w pulpicie szablonu. */
export function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <div data-slot="metric-grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  )
}
