'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { addShiftTaskAction } from '@/actions/shift-tasks'

export interface TaskResidentOption {
  id: string
  label: string
}

interface ShiftTaskFormProps {
  shiftDefinitionId: string
  shiftDate: string
  residents: TaskResidentOption[]
}

/** Dodawanie zadania ręcznego do zmiany. Bez podopiecznego zadanie dotyczy placówki. */
export function ShiftTaskForm({ shiftDefinitionId, shiftDate, residents }: ShiftTaskFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [residentId, setResidentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await addShiftTaskAction({ shiftDefinitionId, shiftDate, residentId: residentId || null, title, dueTime })
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setTitle('')
    setDueTime('')
    setResidentId('')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3" aria-label="Nowe zadanie">
      <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm font-medium">
        Treść zadania
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} className="min-h-touch" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Podopieczny
        <NativeSelect value={residentId} onChange={(e) => setResidentId(e.target.value)}>
          <NativeSelectOption value="">Zadanie placówki</NativeSelectOption>
          {residents.map((r) => (
            <NativeSelectOption key={r.id} value={r.id}>{r.label}</NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Godzina
        <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="min-h-touch" />
      </label>
      <Button type="submit" className="min-h-touch" disabled={busy}>Dodaj zadanie</Button>
      {error && <p role="alert" className="w-full text-sm text-destructive">{error}</p>}
    </form>
  )
}
