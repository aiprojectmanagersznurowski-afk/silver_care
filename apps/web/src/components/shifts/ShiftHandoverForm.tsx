'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SHIFT_TASK_POLICY } from '@silvercare/contracts/src/generated/facility'
import { approveShiftHandoverAction } from '@/actions/shift-handover'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import {
  completenessLabels, formatHandoverTime, handoverSourceLabel, type HandoverCompleteness, type HandoverReceipt,
} from '@/lib/shifts/shift-handover'

interface Props {
  shiftId: string
  date: string
  revision: string
  amendment: boolean
  receipts: HandoverReceipt[]
  incompleteSources: number
}

export function ShiftHandoverForm({ shiftId, date, revision, amendment, receipts, incompleteSources }: Props) {
  const router = useRouter()
  const [completeness, setCompleteness] = useState<HandoverCompleteness>('UNKNOWN')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const complete = completeness === 'COMPLETE'

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setPending(true)
    setError(undefined)
    try {
      const result = await approveShiftHandoverAction({
        shiftId, date, revision, completeness,
        reason: String(fields.get('reason') ?? ''),
        expectedSourceIds: fields.getAll('source').map(String),
      })
      if (result.error) setError(result.error)
      else router.refresh()
    } catch {
      setError('Nie udało się zapisać decyzji. Odśwież stronę przed ponowieniem.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="flex flex-col items-start gap-1 text-sm font-medium">
        Kompletność materiału
        <NativeSelect value={completeness} onChange={(e) => setCompleteness(e.target.value as HandoverCompleteness)}>
          {SHIFT_TASK_POLICY.closure.completeness.map((state) => (
            <NativeSelectOption key={state} value={state} disabled={state === 'COMPLETE' && (!receipts.length || incompleteSources > 0)}>
              {completenessLabels[state]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      {complete ? (
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Oczekiwane źródła z dowodem przyjęcia</legend>
          <p className="text-sm text-muted-foreground">Zaznacz wszystkie oczekiwane źródła, których przyjęcie potwierdza rejestr.</p>
          {receipts.map((receipt) => (
            <label key={receipt.id} className="flex min-h-touch items-center gap-2 text-sm">
              <input name="source" type="checkbox" className="min-h-touch min-w-touch" value={receipt.id} />
              {handoverSourceLabel(receipt.source)} · {formatHandoverTime(receipt.receivedAt)} · {receipt.id.slice(0, 8)}
            </label>
          ))}
        </fieldset>
      ) : (
        <label className="flex max-w-xl flex-col gap-1 text-sm font-medium">
          Powód częściowego zatwierdzenia
          <Textarea name="reason" maxLength={500} required />
        </label>
      )}
      <Button type="submit" className="min-h-touch min-w-touch" disabled={pending}>
        {amendment ? 'Zatwierdź aneks' : 'Zatwierdź przekazanie'}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  )
}
