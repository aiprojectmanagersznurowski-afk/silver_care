'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export function RootRedirector() {
  const router = useRouter()

  useEffect(() => {
    // Sprawdzamy czy w URL znajduje się token sesji (np. po kliknięciu w link zaproszenia)
    const hash = window.location.hash
    if (hash.includes('access_token')) {
      // Jeśli tak, przekierowujemy na stronę ustawiania hasła, przekazując token
      router.push(`/update-password${hash}`)
    } else {
      // Jeśli nie, to zwykły niezalogowany użytkownik wchodzący na stronę główną - na login, przekazujemy hash w razie ewentualnych błędów z Supabase
      router.push(`/login${hash}`)
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Przekierowywanie...</p>
      </div>
    </div>
  )
}
