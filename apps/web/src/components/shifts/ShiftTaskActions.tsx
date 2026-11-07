'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { approveShiftTaskAction, settleShiftTaskAction, type ShiftTaskActionResult } from '@/actions/shift-tasks'
import type { TaskStatus } from '@/lib/shifts/shift-tasks-view'

export interface CarryTarget {
  id: string
  name: string
}

interface ShiftTaskActionsProps {
  taskId: string
  title: string
  status: TaskStatus
  shiftDate: string
  targets: CarryTarget[]
}

/** Działania kierownika zmiany na zadaniu: zatwierdzenie propozycji oraz rozliczenie (wykonane / anulowane z powodem / przeniesione). */
export function ShiftTaskActions({ taskId, title, status, shiftDate, targets }: ShiftTaskActionsProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'cancel' | 'carry' | null>(null)
  const [reason, setReason] = useState('')
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '')
  const [targetDate, setTargetDate] = useState(shiftDate)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<ShiftTaskActionResult>) => {
    setBusy(true)
    setError(null)
    const res = await action()
    setBusy(false)
    if (res.error) setError(res.error)
    else {
      setMode(null)
      router.refresh()
    }
  }

  const btn = 'min-h-touch'
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        {status === 'PROPOSED' && (
          <Button type="button" size="sm" className={btn} disabled={busy} aria-label={`Zatwierdź zadanie: ${title}`} onClick={() => run(() => approveShiftTaskAction(taskId))}>Zatwierdź</Button>
        )}
        {status === 'TODO' && (
          <Button type="button" size="sm" className={btn} disabled={busy} aria-label={`Wykonane: ${title}`} onClick={() => run(() => settleShiftTaskAction({ taskId, path: 'DONE' }))}>Wykonane</Button>
        )}
        <Button type="button" variant="outline" size="sm" className={btn} disabled={busy} aria-label={`Anuluj zadanie: ${title}`} onClick={() => setMode('cancel')}>Anuluj</Button>
        {status === 'TODO' && targets.length > 0 && (
          <Button type="button" variant="outline" size="sm" className={btn} disabled={busy} aria-label={`Przenieś zadanie: ${title}`} onClick={() => setMode('carry')}>Przenieś</Button>
        )}
      </div>
      {mode === 'cancel' && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Powód anulowania
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="min-h-touch" />
          </label>
          <Button type="button" size="sm" className={btn} disabled={busy} onClick={() => run(() => settleShiftTaskAction({ taskId, path: 'CANCELLED', reason }))}>Potwierdź anulowanie</Button>
        </div>
      )}
      {mode === 'carry' && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Zmiana docelowa
            <NativeSelect value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              {targets.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.name}</NativeSelectOption>)}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Data docelowa
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="min-h-touch" />
          </label>
          <Button type="button" size="sm" className={btn} disabled={busy} onClick={() => run(() => settleShiftTaskAction({ taskId, path: 'CARRIED', targetShiftDefinitionId: targetId, targetDate }))}>Potwierdź przeniesienie</Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
