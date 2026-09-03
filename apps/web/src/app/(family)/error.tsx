'use client'

import { useEffect } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'

export default function FamilyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Family Portal Error:', error)
  }, [error])

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center bg-cream font-sans">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-sm ring-8 ring-rose-50">
        <AlertCircle className="h-10 w-10" />
      </div>
      
      <h2 className="text-3xl font-display font-semibold text-slate tracking-tight mb-3">
        Wystąpił problem
      </h2>
      
      <p className="text-base text-slate-soft max-w-md leading-relaxed mb-8">
        Nie udało się załadować tej strony ze względu na nieoczekiwany błąd. 
        Spróbuj ponownie lub wróć później.
      </p>
      
      <button 
        onClick={() => reset()} 
        className="inline-flex items-center gap-2 rounded-xl bg-slate px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate/90 transition-all hover:scale-105"
      >
        <RotateCcw className="h-4 w-4" />
        Spróbuj ponownie
      </button>
    </div>
  )
}
