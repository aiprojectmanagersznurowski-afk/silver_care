'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { SHIFT_POLICY } from '@silvercare/contracts/src/generated/facility'
import { Button } from '@/components/ui/button'
import { recordShiftPlanPrintAction } from '@/actions/shift-tasks'

const printDateTime = new Intl.DateTimeFormat('pl-PL', {
  timeZone: SHIFT_POLICY.timezone,
  dateStyle: 'long',
  timeStyle: 'short',
})

/** Najpierw zapis śladu wydruku w audycie, potem okno drukowania przeglądarki. */
export function PrintPlanButton(props: { shiftDefinitionId: string; shiftDate: string; planVersion: number }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printedAt, setPrintedAt] = useState<Date | null>(null)
  const controls = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reset = () => setPrintedAt(null)
    window.addEventListener('afterprint', reset)
    return () => window.removeEventListener('afterprint', reset)
  }, [])

  const print = async () => {
    setBusy(true)
    setError(null)
    setPrintedAt(null)
    const res = await recordShiftPlanPrintAction(props).catch(() => ({ error: 'Nie udało się zapisać wydruku.' }))
    if (res.error) {
      setError(res.error)
    } else {
      // Przeglądarka pobiera układ synchronicznie po otwarciu dialogu.
      flushSync(() => setPrintedAt(new Date()))
      if (controls.current) window.print()
    }
    setBusy(false)
  }

  return (
    <>
      <div ref={controls} className="flex flex-col items-start gap-1 print:hidden">
        <Button type="button" className="min-h-touch min-w-touch" disabled={busy} onClick={print}>Drukuj plan</Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      {printedAt && (
        <p className="text-sm" data-audited-print>
          Data wydruku <time dateTime={printedAt.toISOString()}>{printDateTime.format(printedAt)}</time>
        </p>
      )}
    </>
  )
}
