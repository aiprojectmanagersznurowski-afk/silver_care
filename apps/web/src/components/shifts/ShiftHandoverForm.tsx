'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SHIFT_TASK_POLICY } from '@silvercare/contracts/src/generated/facility'
import { approveShiftHandoverAction } from '@/actions/shift-handover'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import {
  completenessLabels, type HandoverCompleteness, type HandoverDraft,
} from '@/lib/shifts/shift-handover'

interface Props {
  shiftId: string
  date: string
  revision: string
  amendment: boolean
  evidence: Pick<HandoverDraft, 'audioCompleteness' | 'manifestVersion' | 'missingSources'>
}

export function ShiftHandoverForm({ shiftId, date, revision, amendment, evidence }: Props) {
  const router = useRouter()
  const [completeness, setCompleteness] = useState<HandoverCompleteness>(evidence.audioCompleteness)
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
            <NativeSelectOption key={state} value={state} disabled={state === 'COMPLETE' && evidence.audioCompleteness !== 'COMPLETE'
                || state === 'UNKNOWN' && evidence.audioCompleteness === 'PARTIAL'}>
              {completenessLabels[state]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      {evidence.manifestVersion === null && (
        <p className="text-sm text-muted-foreground">Brak niezależnego wykazu wysyłki dla tej zmiany.</p>
      )}
      {evidence.missingSources > 0 && (
        <p className="text-sm">Źródła z wykazu bez potwierdzenia przetworzenia · {evidence.missingSources}</p>
      )}
      {!complete && (
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
