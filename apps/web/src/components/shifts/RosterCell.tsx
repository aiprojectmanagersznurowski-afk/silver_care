'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { addToRosterAction, removeFromRosterAction, setShiftLeadAction, type RosterActionResult } from '@/actions/shift-roster'
import type { ShiftStaffOption } from '@/lib/shifts/shift-staff'

export interface RosterEntry {
  id: string
  userId: string
  label: string
  role: string
  isLead: boolean
}

interface RosterCellProps {
  shiftDefinitionId: string
  date: string
  code: string
  entries: RosterEntry[]
  staff: ShiftStaffOption[]
}

/** Jedna komórka grafiku: kto pracuje na zmianie w danym dniu, kto jest kierownikiem zmiany. */
export function RosterCell({ shiftDefinitionId, date, code, entries, staff }: RosterCellProps) {
  const router = useRouter()
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const available = staff.filter((s) => !entries.some((e) => e.userId === s.id))

  const run = async (action: () => Promise<RosterActionResult>) => {
    setBusy(true)
    setError(null)
    const res = await action()
    setBusy(false)
    if (res.error) setError(res.error)
    else router.refresh()
  }

  const add = () =>
    run(async () => {
      const res = await addToRosterAction({ shiftDefinitionId, shiftDate: date, userId: selected })
      if (!res.error) setSelected('')
      return res
    })

  return (
    <div data-testid={`roster-cell-${date}-${code}`} className="space-y-2">
      <ul className="space-y-1">
        {entries.map((e) => (
          <li key={e.id} data-testid="roster-entry" className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-foreground">{e.label}</span>
            {e.isLead && <StatusBadge tone="brand">Kierownik zmiany</StatusBadge>}
            {!e.isLead && e.role === 'nurse' && (
              <Button type="button" variant="outline" size="sm" className="min-h-touch" disabled={busy}
                aria-label={`Wyznacz ${e.label} jako kierownika zmiany`} onClick={() => run(() => setShiftLeadAction(e.id))}>
                Wyznacz kierownikiem
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" className="min-h-touch" disabled={busy}
              aria-label={`Usuń ${e.label} z grafiku`} onClick={() => run(() => removeFromRosterAction(e.id))}>
              Usuń
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect aria-label="Dodaj osobę do grafiku" value={selected} onChange={(ev) => setSelected(ev.target.value)} disabled={busy}>
          <NativeSelectOption value="">Wybierz osobę</NativeSelectOption>
          {available.map((s) => (
            <NativeSelectOption key={s.id} value={s.id}>{s.label}</NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="button" variant="outline" size="sm" className="min-h-touch" disabled={busy || !selected} onClick={add}>
          Dodaj do grafiku
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
