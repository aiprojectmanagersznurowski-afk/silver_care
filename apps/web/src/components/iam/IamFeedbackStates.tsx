'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertCircle, UserCog } from 'lucide-react'

export function IamLoadingState() {
  return (
    <div className="space-y-8 animate-pulse" aria-busy="true" aria-label="Ładowanie panelu uprawnień">
      <div className="h-10 w-72 rounded-xl bg-muted" />
      <div className="h-64 rounded-xl bg-muted" />
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  )
}

export function IamErrorState({ errorMessage }: { errorMessage?: string }) {
  return (
    <Card className="rounded-xl border-destructive/20 bg-destructive/5 p-8 text-center" role="alert">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-4">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">Błąd wczytywania danych IAM</h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        {errorMessage || 'Wystąpił problem podczas pobierania rejestru uprawnień lub użytkowników.'}
      </p>
      <Button
        onClick={() => window.location.reload()}
        className="min-h-touch rounded-xl px-6 bg-foreground text-white hover:bg-muted"
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Spróbuj ponownie
      </Button>
    </Card>
  )
}

export function IamEmptyState() {
  return (
    <Card className="rounded-xl border-none ring-1 ring-border p-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
        <UserCog className="h-8 w-8" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">Brak zarejestrowanych kont</h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        W systemie nie odnaleziono jeszcze żadnych kont użytkowników. Gdy administratorzy placówek lub personel dołączą do platformy, pojawią się w tym panelu.
      </p>
    </Card>
  )
}
