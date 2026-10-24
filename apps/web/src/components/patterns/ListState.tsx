import { AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface ListEmptyProps {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  /** Ramka przerywana poza tabelą; w wierszu tabeli bez ramki. */
  framed?: boolean
}

/** Stan pusty listy (UI-FOUR-STATES): mówi, czego brak i co można zrobić. Bez zmyślonej treści. */
export function ListEmpty({ title, description, icon, action, framed = true }: ListEmptyProps) {
  return (
    <Empty data-slot="list-empty" className={cn('py-10', framed && 'border border-dashed border-border bg-muted/30')}>
      <EmptyHeader>
        {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
        <EmptyTitle className="text-base font-semibold text-foreground">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}

/** Stan ładowania: szkielet wierszy o wysokości celu dotykowego i komunikat dla czytnika ekranu. */
export function ListLoading({ label = 'Wczytywanie danych…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div data-slot="list-loading" aria-busy="true" className="space-y-3 p-4">
      <span role="status" className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  )
}

interface ListErrorProps {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
}

/** Stan błędu technicznego — jedyne miejsce wspólnych komponentów z tonem destructive (ADR-017 pkt 2). */
export function ListError({ title = 'Nie udało się wczytać danych', description, action }: ListErrorProps) {
  return (
    <div
      data-slot="list-error"
      role="alert"
      className="flex flex-col items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"
    >
      <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}
