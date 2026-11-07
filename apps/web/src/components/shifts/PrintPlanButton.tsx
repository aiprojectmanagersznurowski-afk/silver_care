'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { recordShiftPlanPrintAction } from '@/actions/shift-tasks'

/** Najpierw zapis śladu wydruku w audycie, potem okno drukowania przeglądarki. */
export function PrintPlanButton({ shiftDefinitionId, shiftDate }: { shiftDefinitionId: string; shiftDate: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const print = async () => {
    setBusy(true)
    setError(null)
    const res = await recordShiftPlanPrintAction({ shiftDefinitionId, shiftDate })
    setBusy(false)
    if (res.error) setError(res.error)
    else window.print()
  }

  return (
    <div className="flex flex-col items-start gap-1 print:hidden">
      <Button type="button" className="min-h-touch" disabled={busy} onClick={print}>Drukuj plan</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
