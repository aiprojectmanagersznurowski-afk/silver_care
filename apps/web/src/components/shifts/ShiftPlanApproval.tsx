'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { approveShiftPlanAction } from '@/actions/shift-tasks'

interface ShiftPlanApprovalProps {
  shiftDefinitionId: string
  shiftDate: string
  version: number | null
  canApprove: boolean
  printHref: string | null
}

/** Stan akceptacji planu zmiany. Zatwierdza kierownik zmiany albo kierownik placówki; każda akceptacja to nowa wersja. */
export function ShiftPlanApproval({ shiftDefinitionId, shiftDate, version, canApprove, printHref }: ShiftPlanApprovalProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const approve = async () => {
    setBusy(true)
    setError(null)
    const res = await approveShiftPlanAction({ shiftDefinitionId, shiftDate })
    setBusy(false)
    if (res.error) setError(res.error)
    else router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p data-testid="plan-approval-status" className="text-sm text-foreground">
        {version ? `Plan zatwierdzony, wersja ${version}` : 'Plan nie został zatwierdzony'}
      </p>
      {canApprove && (
        <Button type="button" variant="outline" size="sm" className="min-h-touch" disabled={busy} onClick={approve}>Zatwierdź plan</Button>
      )}
      {printHref && (
        <Link href={printHref} className="inline-flex min-h-touch items-center rounded-lg border border-input px-3 text-sm hover:bg-muted">Drukuj plan</Link>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
