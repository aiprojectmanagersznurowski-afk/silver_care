'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, AlertCircle, RefreshCw } from 'lucide-react'

export function OrganizationsLoadingState() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Ładowanie listy placówek">
      <div className="h-10 w-72 rounded-xl bg-muted" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-56 rounded-xl bg-muted" />
        <div className="h-56 rounded-xl bg-muted" />
      </div>
    </div>
  )
}

export function OrganizationsErrorState({ errorMessage }: { errorMessage?: string }) {
  return (
    <Card className="rounded-xl border-destructive/20 bg-destructive/5 p-8 text-center" role="alert">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-4">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">Błąd wczytywania placówek</h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        {errorMessage || 'Wystąpił problem podczas pobierania podsumowania organizacji.'}
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

export function OrganizationsEmptyState({ renderActionSlot }: { renderActionSlot?: React.ReactNode }) {
  return (
    <Card className="rounded-xl border-none ring-1 ring-border p-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
        <Building2 className="h-8 w-8" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">Brak zarejestrowanych placówek</h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        W systemie nie zarejestrowano jeszcze żadnego ośrodka. Utwórz pierwszą placówkę, aby rozpocząć konfigurację platformy.
      </p>
      {renderActionSlot && (
        <div className="flex justify-center">
          {renderActionSlot}
        </div>
      )}
    </Card>
  )
}
