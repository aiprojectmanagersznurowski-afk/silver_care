'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function FamilyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center space-y-4 text-center">
      <h2 className="text-xl font-semibold text-destructive">Wystąpił błąd</h2>
      <p className="text-sm text-text-secondary max-w-sm">
        Nie udało się załadować tej strony. Spróbuj ponownie lub skontaktuj się z administratorem.
      </p>
      <Button onClick={() => reset()} variant="outline">
        Spróbuj ponownie
      </Button>
    </div>
  )
}
