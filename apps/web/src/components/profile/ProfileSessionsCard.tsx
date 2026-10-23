'use client'

import React, { useState, useTransition } from 'react'
import { signOutOthersAction } from '@/actions/profile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function ProfileSessionsCard() {
  const [isPending, startTransition] = useTransition()
  const [sessionState, setSessionState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error'
    message?: string
  }>({ status: 'idle' })

  const handleSignOutOthers = async () => {
    setSessionState({ status: 'loading' })
    startTransition(async () => {
      const res = await signOutOthersAction()
      if (res.error) {
        setSessionState({ status: 'error', message: res.error })
      } else {
        setSessionState({ status: 'success', message: res.message })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zarządzanie Sesjami i MFA</CardTitle>
        <CardDescription>
          Kontroluj urządzenia z aktywnym dostępem do Twojego konta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {sessionState.status === 'error' && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
            {sessionState.message}
          </div>
        )}
        {sessionState.status === 'success' && (
          <div className="p-3 text-sm text-foreground bg-muted rounded-md border border-border">
            {sessionState.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg bg-muted">
          <div>
            <h4 className="font-medium text-foreground">Pozostałe aktywne urządzenia</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Wyloguj wszystkie sesje poza tą przeglądarką, jeśli podejrzewasz nieautoryzowany dostęp.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleSignOutOthers}
            disabled={isPending || sessionState.status === 'loading'}
            className="min-h-touch px-4"
          >
            {sessionState.status === 'loading' ? 'Wylogowywanie...' : 'Wyloguj inne sesje'}
          </Button>
        </div>

        <div className="p-4 border rounded-lg bg-muted space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-medium text-foreground">Uwierzytelnianie dwuskładnikowe (MFA / TOTP)</h4>
              <p className="text-sm text-muted-foreground mt-0.5">
                Drugi składnik logowania zapewnia najwyższy poziom ochrony danych pensjonariuszy zgodnie z normami RODO Art. 9.
              </p>
            </div>
            <Badge variant="outline" className="w-fit text-sm border-border bg-card text-muted-foreground whitespace-nowrap">
              Planowane w kolejnym wydaniu
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
