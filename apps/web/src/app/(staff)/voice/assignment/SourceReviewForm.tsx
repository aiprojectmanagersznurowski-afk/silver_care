'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { SHIFT_POLICY } from '@silvercare/contracts/src/generated/facility'
import { RESIDENT_ASSIGNMENT } from '@silvercare/contracts/src/generated/voice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

const review = RESIDENT_ASSIGNMENT.sourceReview
const [shiftOnly, verified] = review.timeModes
const basisLabels = {
  ROSTER_VERIFIED: 'Sprawdzony grafik zmiany',
  SOURCE_VERIFIED: 'Sprawdzone źródło nagrania',
  STAFF_CONFIRMED: 'Potwierdzenie personelu',
} satisfies Record<(typeof review.bases)[number], string>

export interface ReviewPosition { segmentId: string; version: number; queueHref: string }
interface Shift { id: string; name: string }

export function useVoiceReview({ segmentId, version, queueHref }: ReviewPosition) {
  const router = useRouter()
  const retry = useRef<{ input: string; requestId: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const reload = () => router.refresh()

  function save(command: Record<string, unknown>) {
    setError('')
    setConflict(false)
    const input = JSON.stringify(command)
    if (retry.current?.input !== input) retry.current = { input, requestId: crypto.randomUUID() }
    const { requestId } = retry.current
    startTransition(async () => {
      const response = await fetch('/api/voice/assignment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...command, segmentId, expectedVersion: version, requestId }),
      }).catch(() => null)
      const result = await response?.json().catch(() => null)
      if (!response?.ok || !result) {
        setError(result?.error ?? 'Nie udało się zapisać decyzji. Spróbuj ponownie.')
        setConflict(response?.status === 409)
        return
      }
      if (result.closed) router.replace(queueHref, { scroll: false })
      reload()
    })
  }
  return { save, error, pending, conflict, reload }
}

export function VoiceDecisionFeedback({ error, conflict, reload }: Pick<ReturnType<typeof useVoiceReview>, 'error' | 'conflict' | 'reload'>) {
  return <>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {conflict && <Button type="button" variant="outline" className="min-h-touch" onClick={reload}>Odśwież fragment</Button>}
  </>
}

const wallTime = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHIFT_POLICY.timezone, timeZoneName: 'longOffset', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
})
const timeParts = (ms: number) => Object.fromEntries(wallTime.formatToParts(ms).map(({ type, value }) => [type, value]))

function offsetsFor(local: string) {
  const apparentUtc = Date.parse(`${local}Z`)
  if (!Number.isFinite(apparentUtc)) return []
  const day = 86400000
  const offsets = new Set([apparentUtc - day, apparentUtc + day].flatMap((ms) => {
    const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(timeParts(ms).timeZoneName)
    return match ? [(match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]))] : []
  }))
  return [...offsets].filter((offset) => {
    const { year, month, day, hour, minute, second } = timeParts(apparentUtc - offset * 60000)
    return `${year}-${month}-${day}T${hour}:${minute}:${second}` === (local.length === 16 ? `${local}:00` : local)
  })
}

function offsetLabel(offset: number) {
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0')
  return `UTC${offset < 0 ? '−' : '+'}${hours}:${minutes}`
}

export function VoiceTimeCorrection({ position, shifts, shiftId, shiftDate }: {
  position: ReviewPosition; shifts: Shift[]; shiftId: string | null; shiftDate: string | null
}) {
  const decision = useVoiceReview(position)
  const [mode, setMode] = useState<string>(verified)
  const [local, setLocal] = useState('')
  const [chosenOffset, setChosenOffset] = useState('')
  const offsets = offsetsFor(local)
  const offset = offsets.length === 1 ? String(offsets[0]) : chosenOffset

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const timing = mode === shiftOnly
      ? { shiftDefinitionId: form.get('shift'), shiftDate: form.get('date') }
      : { localStart: local, utcOffsetMinutes: Number(offset) }
    if (mode === verified && (offset === '' || !offsets.includes(Number(offset)))) return
    decision.save({ action: 'time', mode, basis: form.get('basis'), ...timing })
  }

  return <form aria-label="Korekta czasu nagrania" className="space-y-3 rounded-md border border-border p-3" onSubmit={submit}>
    <h2 className="font-medium">Korekta czasu nagrania</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1">
        <span className="block">Ustalenie czasu</span>
        <NativeSelect value={mode} onChange={(event) => setMode(event.target.value)} className="min-h-touch">
          <NativeSelectOption value={verified}>Zweryfikowany początek fragmentu</NativeSelectOption>
          {shifts.length > 0 && <NativeSelectOption value={shiftOnly}>Znana tylko zmiana</NativeSelectOption>}
        </NativeSelect>
      </label>
      <label className="space-y-1">
        <span className="block">Podstawa decyzji</span>
        <NativeSelect required name="basis" className="min-h-touch">
          <NativeSelectOption value="">Wybierz podstawę</NativeSelectOption>
          {review.bases.map((basis) => <NativeSelectOption key={basis} value={basis}>{basisLabels[basis]}</NativeSelectOption>)}
        </NativeSelect>
      </label>
      {mode === shiftOnly ? <>
        <label className="space-y-1">
          <span className="block">Zmiana</span>
          <NativeSelect name="shift" defaultValue={shiftId ?? ''} required className="min-h-touch">
            <NativeSelectOption value="">Wybierz zmianę</NativeSelectOption>
            {shifts.map(({ id, name }) => <NativeSelectOption key={id} value={id}>{name}</NativeSelectOption>)}
          </NativeSelect>
        </label>
        <label className="space-y-1"><span className="block">Data początku zmiany</span>
          <Input name="date" type="date" defaultValue={shiftDate ?? ''} required className="min-h-touch" />
        </label>
      </> : <>
        <label className="space-y-1"><span className="block">Lokalny początek fragmentu</span>
          <Input type="datetime-local" value={local} required step={1} className="min-h-touch"
            onChange={(event) => { setLocal(event.target.value); setChosenOffset('') }} />
        </label>
        <label className="space-y-1"><span className="block">Przesunięcie UTC</span>
          <NativeSelect value={offset} required className="min-h-touch" onChange={(event) => setChosenOffset(event.target.value)}>
            <NativeSelectOption value="">Wybierz przesunięcie</NativeSelectOption>
            {offsets.map((value) => <NativeSelectOption key={value} value={String(value)}>{offsetLabel(value)}</NativeSelectOption>)}
          </NativeSelect>
        </label>
        {local && offsets.length === 0 && <p role="status" className="text-sm text-muted-foreground">Ta godzina nie występuje w strefie {SHIFT_POLICY.timezone}.</p>}
      </>}
    </div>
    <VoiceDecisionFeedback {...decision} />
    <Button className="min-h-touch" type="submit" disabled={decision.pending}>Zapisz korektę</Button>
  </form>
}

export function VoiceSplitReview({ position, startMs, endMs, audioAvailable }: {
  position: ReviewPosition; startMs: number; endMs: number; audioAvailable: boolean
}) {
  const decision = useVoiceReview(position)
  const audio = useRef<HTMLAudioElement>(null)
  const [available, setAvailable] = useState(audioAvailable)
  const [points, setPoints] = useState([''])
  const [excluded, setExcluded] = useState<number[]>([])
  const duration = endMs - startMs
  const cuts = [0, ...points.map((point) => Math.round(Number(point) * 1000)), duration]
  const valid = cuts.slice(1).every((point, index) => Number.isSafeInteger(point) && point > cuts[index])
  const setPoint = (index: number, value: string) => setPoints((previous) => previous.map((point, item) => item === index ? value : point))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!available || !valid) return
    decision.save({ action: 'split', parts: cuts.slice(1).map((end, index) => ({
      start_ms: startMs + cuts[index], end_ms: startMs + end, excluded: excluded.includes(index),
    })) })
  }

  if (!available) return <p role="status" className="text-muted-foreground">Nagranie do odsłuchu jest niedostępne.</p>
  return <form aria-label="Podział fragmentu" onSubmit={submit} className="space-y-3 rounded-md border border-border p-3">
    <h2 className="font-medium">Podział fragmentu</h2>
    <p className="text-muted-foreground">Punkty podaj w sekundach od początku odsłuchu. Zakres w pliku: {startMs / 1000}–{endMs / 1000} s.</p>
    <audio ref={audio} controls preload="metadata" className="w-full" aria-label="Odsłuch fragmentu"
      src={`/api/voice/assignment?segment=${position.segmentId}`} onError={() => setAvailable(false)} />
    {points.map((point, index) => <div key={index} className="flex flex-wrap items-end gap-2">
      <label className="space-y-1"><span className="block">Punkt podziału {index + 1} (s)</span>
        <Input type="number" step={0.001} min={0.001} max={(duration - 1) / 1000} value={point} required
          className="min-h-touch" onChange={(event) => setPoint(index, event.target.value)} />
      </label>
      <Button type="button" variant="outline" className="min-h-touch" onClick={() => {
        if (audio.current) setPoint(index, audio.current.currentTime.toFixed(3))
      }}>Ustaw z odtwarzacza</Button>
    </div>)}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" className="min-h-touch" disabled={points.length + 1 >= review.splitMaxParts}
        onClick={() => setPoints([...points, ''])}>Dodaj punkt</Button>
      <Button type="button" variant="outline" className="min-h-touch" disabled={points.length === 1}
        onClick={() => { setPoints(points.slice(0, -1)); setExcluded(excluded.filter((index) => index < points.length)) }}>Usuń ostatni punkt</Button>
    </div>
    {valid && cuts.slice(1).map((end, index) => <label key={index} className="flex min-h-touch items-center gap-2">
      <input type="checkbox" checked={excluded.includes(index)}
        onChange={(event) => setExcluded(event.target.checked ? [...excluded, index] : excluded.filter((item) => item !== index))} />
      Oznacz część {index + 1} ({cuts[index] / 1000}–{end / 1000} s) jako nie do przypisania
    </label>)}
    <VoiceDecisionFeedback {...decision} />
    <Button className="min-h-touch" type="submit" disabled={!valid || decision.pending}>Zatwierdź podział</Button>
  </form>
}
