'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function VoiceFactDecision({ segmentId, canInclude }: { segmentId: string; canInclude: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const review = (accept: boolean) => startTransition(async () => {
    setError('')
    const response = await fetch('/api/voice/family-facts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ segmentId, accept }),
    }).catch(() => null)
    if (!response?.ok) {
      const result = await response?.json().catch(() => null)
      setError(result?.error ?? 'Nie udało się zapisać decyzji.')
      return
    }
    router.refresh()
  })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="min-h-touch" disabled={pending || !canInclude} onClick={() => review(true)}>
          Uwzględnij w szkicu
        </Button>
        <Button type="button" variant="outline" className="min-h-touch" disabled={pending} onClick={() => review(false)}>
          Pomiń
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
