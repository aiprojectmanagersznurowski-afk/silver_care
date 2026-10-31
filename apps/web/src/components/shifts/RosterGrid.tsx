import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { TableCard } from '@/components/patterns/TableCard'
import { RosterCell, type RosterEntry } from '@/components/shifts/RosterCell'
import { formatDayLabel, formatWeekLabel, shiftWeek, weekDays } from '@/lib/shifts/roster-week'
import { formatShiftRange, trimSeconds } from '@/lib/shifts/shift-definitions'
import type { ShiftStaffOption } from '@/lib/shifts/shift-staff'

export interface RosterShift {
  id: string
  name: string
  code: string
  start_time: string
  end_time: string
}

interface RosterGridProps {
  weekStart: string
  shifts: RosterShift[]
  entriesByCell: Record<string, RosterEntry[]>
  staff: ShiftStaffOption[]
}

/** Grafik tygodnia: dni × aktywne zmiany (NUR-SHIFT-LEAD). Nawigacja tygodni to zwykłe linki z ?week=. */
export function RosterGrid({ weekStart, shifts, entriesByCell, staff }: RosterGridProps) {
  const navClass = 'inline-flex min-h-touch items-center gap-1 rounded-lg border border-input px-3 text-sm hover:bg-muted'
  return (
    <TableCard
      title="Grafik tygodnia"
      description={<span data-testid="roster-week-label">{formatWeekLabel(weekStart)}</span>}
      actions={
        <nav className="flex gap-2" aria-label="Zmiana tygodnia">
          <Link href={`?week=${shiftWeek(weekStart, -1)}`} className={navClass}><ChevronLeft className="size-4" aria-hidden />Poprzedni tydzień</Link>
          <Link href={`?week=${shiftWeek(weekStart, 1)}`} className={navClass}>Następny tydzień<ChevronRight className="size-4" aria-hidden /></Link>
        </nav>
      }
    >
      {shifts.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Dodaj co najmniej jedną aktywną zmianę, aby ułożyć grafik.</p>
      ) : (
        <div className="divide-y">
          {weekDays(weekStart).map((date) => (
            <section key={date} className="grid gap-3 p-4 md:grid-cols-[10rem_1fr]" aria-label={formatDayLabel(date)}>
              <h3 className="text-sm font-medium capitalize text-foreground">{formatDayLabel(date)}</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {shifts.map((s) => (
                  <div key={s.id} className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {s.name} · {formatShiftRange(trimSeconds(s.start_time), trimSeconds(s.end_time))}
                    </p>
                    <RosterCell shiftDefinitionId={s.id} date={date} code={s.code} entries={entriesByCell[`${s.id}|${date}`] ?? []} staff={staff} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </TableCard>
  )
}
