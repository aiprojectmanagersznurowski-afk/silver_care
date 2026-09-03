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
    <div className="flex h-[50vh] flex-col items-center justify-center space-y-6 text-center bg-cream">
      <div>
        <h2 className="text-2xl font-display text-slate">Wystąpił błąd</h2>
        <p className="mt-2 text-[1rem] text-slate-soft max-w-sm leading-relaxed">
          Nie udało się załadować tej strony. Spróbuj ponownie lub skontaktuj się z administracją.
        </p>
      </div>
      <Button 
        onClick={() => reset()} 
        className="rounded-full bg-sage px-6 text-primary-foreground hover:bg-sage/90"
      >
        Spróbuj ponownie
      </Button>
    </div>
  )
}
