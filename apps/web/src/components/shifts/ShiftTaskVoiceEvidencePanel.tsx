'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SHIFT_POLICY } from '@silvercare/contracts/src/generated/facility'
import { formatAuditTimestamp } from '@/lib/audit-helpers'
import type { ShiftTaskVoiceEvidence, VoiceTaskDecision } from '@/lib/shifts/shift-task-voice-evidence'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import type { CarryTarget } from './ShiftTaskActions'

const evidenceLabels: Record<string, string> = {
  COMPLETED: 'Wykonane?',
  NOT_COMPLETED: 'Niewykonane',
  REFUSED: 'Odmowa',
}
const sourceLabels: Record<string, string> = {
  APP: 'Nagranie o podopiecznym',
  APP_GENERAL: 'Nagranie ogólne',
  DEVICE: 'Dyktafon',
}
const attributionLabels: Record<string, string> = {
  AUTHENTICATED_SESSION: 'Sesja webowa',
  DECLARED_SESSION: 'Deklaracja w nagraniu',
  MANUAL_SEGMENT_CORRECTION: 'Ręczne ustalenie autora',
}

export function ShiftTaskVoiceEvidencePanel({ evidence, targets, shiftDate }: {
  evidence: ShiftTaskVoiceEvidence[]
  targets: CarryTarget[]
  shiftDate: string
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'CANCELLED' | 'CARRIED' | null>(null)
  const [reason, setReason] = useState('')
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '')
  const [targetDate, setTargetDate] = useState(shiftDate)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const latest = evidence[0]
  if (!latest) return null
  const completed = latest.kind === 'COMPLETED'
  const conflicting = evidence.some(({ kind }) => (kind === 'COMPLETED') !== completed)

  async function submit(decision: VoiceTaskDecision) {
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/staff/shift-tasks/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidenceId: latest.id, decision, reason, targetShiftDefinitionId: targetId, targetDate }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) setError(result?.error ?? 'Nie udało się rozliczyć zadania.')
      if (response.ok || response.status === 409 || response.status === 403) router.refresh()
      if (response.ok) setMode(null)
    } catch {
      setError('Nie udało się połączyć z serwerem.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2 border-b border-border pb-3">
      {conflicting ? (
        <p role="status" className="text-sm">Nagrania zawierają sprzeczne wzmianki. Rozlicz zadanie ręcznie.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {evidence.map((entry) => (
              <li key={entry.id} className="space-y-1">
                <StatusBadge>{evidenceLabels[entry.kind]}</StatusBadge>
                <blockquote className="whitespace-normal break-words text-sm">{entry.quote}</blockquote>
                <p className="text-xs text-muted-foreground">
                  {sourceLabels[entry.source_kind]} · {formatAuditTimestamp(entry.recorded_at, SHIFT_POLICY.timezone)} · {attributionLabels[entry.author_attribution]}
                </p>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {completed ? (
              <Button type="button" size="sm" className="min-h-touch min-w-touch" disabled={pending}
                onClick={() => void submit('DONE')}>Potwierdź wykonanie z nagrania</Button>
            ) : (
              <>
                <Button type="button" size="sm" variant="outline" className="min-h-touch min-w-touch" disabled={pending}
                  onClick={() => setMode('CANCELLED')}>Anuluj na podstawie nagrania</Button>
                {targets.length > 0 && (
                  <Button type="button" size="sm" variant="outline" className="min-h-touch min-w-touch" disabled={pending}
                    onClick={() => setMode('CARRIED')}>Przenieś na podstawie nagrania</Button>
                )}
              </>
            )}
            <Button type="button" size="sm" variant="outline" className="min-h-touch min-w-touch" disabled={pending}
              onClick={() => void submit('REJECTED')}>Odrzuć podpowiedź</Button>
          </div>
          {mode === 'CANCELLED' && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1 text-sm">
                <span>Powód anulowania z nagrania</span>
                <Input value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-touch" />
              </label>
              <Button type="button" size="sm" className="min-h-touch min-w-touch" disabled={pending}
                onClick={() => void submit('CANCELLED')}>Potwierdź anulowanie z nagrania</Button>
            </div>
          )}
          {mode === 'CARRIED' && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1 text-sm">
                <span>Zmiana docelowa podpowiedzi</span>
                <NativeSelect value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                  {targets.map(({ id, name }) => <NativeSelectOption key={id} value={id}>{name}</NativeSelectOption>)}
                </NativeSelect>
              </label>
              <label className="space-y-1 text-sm">
                <span>Data docelowa podpowiedzi</span>
                <Input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="min-h-touch" />
              </label>
              <Button type="button" size="sm" className="min-h-touch min-w-touch" disabled={pending}
                onClick={() => void submit('CARRIED')}>Potwierdź przeniesienie z nagrania</Button>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </>
      )}
    </div>
  )
}
