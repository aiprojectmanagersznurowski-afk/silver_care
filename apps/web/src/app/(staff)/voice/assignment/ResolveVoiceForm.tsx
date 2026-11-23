'use client'

import { RESIDENT_ASSIGNMENT } from '@silvercare/contracts/src/generated/voice'
import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

interface Option { id: string; label: string }

const scopeLabels = {
  RESIDENT: 'Podopieczny',
  FACILITY: 'Sprawa placówki',
  UNASSIGNABLE: 'Nie do przypisania',
} satisfies Record<(typeof RESIDENT_ASSIGNMENT.outcomes)[number], string>

export function ResolveVoiceForm({ segmentId, residents, staff, author, unassignableOnly = false }: {
  segmentId: string; residents: Option[]; staff: Option[]; author: string | null; unassignableOnly?: boolean
}) {
  const [scope, setScope] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const outcomes = RESIDENT_ASSIGNMENT.outcomes.filter((outcome) => !unassignableOnly || outcome === 'UNASSIGNABLE')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError('')
    startTransition(async () => {
      const response = await fetch('/api/voice/assignment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ segmentId, scope, residentId: form.get('resident'), authorId: form.get('author') }),
      }).catch(() => null)
      if (!response?.ok) {
        const data = await response?.json().catch(() => null)
        setError(data?.error ?? 'Nie udało się zapisać decyzji.')
        return
      }
      router.replace('/voice/assignment')
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1">
        <span>Przypisanie fragmentu</span>
        <NativeSelect required value={scope} onChange={(event) => setScope(event.target.value)} className="min-h-touch">
          <NativeSelectOption value="">Wybierz zakres</NativeSelectOption>
          {outcomes.map((outcome) => <NativeSelectOption key={outcome} value={outcome}>{scopeLabels[outcome]}</NativeSelectOption>)}
        </NativeSelect>
      </label>
      {scope === 'RESIDENT' && (
        <label className="block space-y-1">
          <span>Podopieczny</span>
          <NativeSelect required name="resident" className="min-h-touch">
            <NativeSelectOption value="">Wybierz podopiecznego</NativeSelectOption>
            {residents.map(({ id, label }) => <NativeSelectOption key={id} value={id}>{label}</NativeSelectOption>)}
          </NativeSelect>
        </label>
      )}
      {!unassignableOnly && (
        <label className="block space-y-1">
          <span>Autor fragmentu</span>
          <NativeSelect name="author" required={!author && scope !== 'UNASSIGNABLE'} className="min-h-touch">
            <NativeSelectOption value="">{author ? 'Zachowaj ustalonego autora' : 'Wybierz autora'}</NativeSelectOption>
            {staff.map(({ id, label }) => <NativeSelectOption key={id} value={id}>{label}</NativeSelectOption>)}
          </NativeSelect>
        </label>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="min-h-touch" type="submit" disabled={pending}>Zapisz decyzję</Button>
    </form>
  )
}
