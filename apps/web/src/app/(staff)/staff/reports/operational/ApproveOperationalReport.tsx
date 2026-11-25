'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ApproveOperationalReport({ reportId }: { reportId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const approve = () => startTransition(async () => {
    setError('')
    const response = await fetch('/api/voice/operational-reports/approve', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reportId }),
    }).catch(() => null)
    if (!response?.ok) {
      const result = await response?.json().catch(() => null)
      setError(result?.error ?? 'Nie udało się zatwierdzić raportu.')
      return
    }
    router.refresh()
  })

  return (
    <div className="space-y-2">
      <Button type="button" className="min-h-touch" onClick={approve} disabled={pending}>Zatwierdź raport operacyjny</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
