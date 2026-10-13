'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Błąd panelu administracyjnego:', error)
  }, [error])

  return (
    <div className="flex h-[50vh] flex-col items-center justify-center space-y-4 text-center p-6">
      <h2 className="text-xl font-semibold text-destructive">Wystąpił problem w panelu administracyjnym</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Operacja nie mogła zostać ukończona. Spróbuj odświeżyć widok lub powtórzyć czynność.
      </p>
      <Button onClick={() => reset()} variant="outline">
        Spróbuj ponownie
      </Button>
    </div>
  )
}
