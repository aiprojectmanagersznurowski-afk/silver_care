'use client'

import React, { useState, useTransition } from 'react'
import { changePasswordAction } from '@/actions/profile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ProfilePasswordCard() {
  const [isPending, startTransition] = useTransition()
  const [passwordState, setPasswordState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error'
    message?: string
  }>({ status: 'idle' })

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPasswordState({ status: 'loading' })
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = await changePasswordAction(formData)
      if (res.error) {
        setPasswordState({ status: 'error', message: res.error })
      } else {
        setPasswordState({ status: 'success', message: res.message })
        form.reset()
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zmiana Hasła</CardTitle>
        <CardDescription>
          Hasło musi zawierać min. 8 znaków, w tym wielką literę, cyfrę oraz znak specjalny.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handlePasswordSubmit}>
        <CardContent className="space-y-4 pb-6">
          {passwordState.status === 'error' && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {passwordState.message}
            </div>
          )}
          {passwordState.status === 'success' && (
            <div className="p-3 text-sm text-foreground bg-muted rounded-md border border-border">
              {passwordState.message}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword">Bieżące hasło</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              disabled={isPending}
              placeholder="Wpisz bieżące hasło"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Nowe hasło</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              disabled={isPending}
              placeholder="Wpisz nowe bezpieczne hasło"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Potwierdź nowe hasło</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              disabled={isPending}
              placeholder="Powtórz nowe hasło"
            />
          </div>
        </CardContent>
        <CardFooter className="p-6 pt-4">
          <Button type="submit" disabled={isPending || passwordState.status === 'loading'} className="min-h-11 px-4">
            {passwordState.status === 'loading' ? 'Zmienianie hasła...' : 'Zmień hasło'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
