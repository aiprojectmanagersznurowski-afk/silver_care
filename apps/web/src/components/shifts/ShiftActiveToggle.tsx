'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { setShiftDefinitionActiveAction } from '@/actions/shifts'

/** Aktywacja i dezaktywacja zmiany. Zmian się nie usuwa — dezaktywowana znika z nowych grafików. */
export function ShiftActiveToggle({ definitionId, isActive }: { definitionId: string; isActive: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = async () => {
    setBusy(true)
    setError(null)
    const res = await setShiftDefinitionActiveAction(definitionId, !isActive)
    setBusy(false)
    if (res.error) setError(res.error)
    else router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" className="min-h-touch" disabled={busy} onClick={toggle}>
        {isActive ? 'Dezaktywuj' : 'Aktywuj'}
      </Button>
      {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
    </div>
  )
}
