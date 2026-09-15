'use client'

import React, { useState, useTransition } from 'react'
import { changePasswordAction, signOutOthersAction } from '@/actions/profile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface ProfileData {
  user: {
    id: string
    email?: string
    role: string
    organizationId?: string | null
    lastSignInAt?: string
  }
  logs: Array<{
    id: string
    action: string
    created_at: string
    payload: any
  }>
}

export function ProfileSecurityClient({ initialData }: { initialData: ProfileData }) {
  const [isPending, startTransition] = useTransition()
  const [passwordState, setPasswordState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error'
    message?: string
  }>({ status: 'idle' })

  const [sessionState, setSessionState] = useState<{
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

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Administrator',
    org_admin: 'Administrator Placówki',
    admin: 'Administrator Placówki',
    nurse: 'Pielęgniarka / Personel Medyczny',
    caregiver: 'Opiekun',
    paramedic: 'Ratownik Medyczny',
    family: 'Bliski / Rodzina',
    legal_guardian: 'Opiekun Prawny',
  }

  const isStaffOrAdmin = ['super_admin', 'org_admin', 'admin', 'nurse', 'caregiver', 'paramedic'].includes(initialData.user.role)

  return (
    <div className="space-y-6">
      {/* 1. Karta Informacji o Profilu */}
      <Card>
        <CardHeader>
          <CardTitle>Dane Użytkownika</CardTitle>
          <CardDescription>Twoje konto oraz przypisane uprawnienia w systemie.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500 block">Adres E-mail:</span>
              <span className="font-medium text-slate-900">{initialData.user.email}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Rola w systemie:</span>
              <div className="mt-1">
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                  {roleLabels[initialData.user.role] || initialData.user.role}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-slate-500 block">Identyfikator (UUID):</span>
              <span className="font-mono text-xs text-slate-600">{initialData.user.id}</span>
            </div>
            {initialData.user.organizationId && (
              <div>
                <span className="text-slate-500 block">Identyfikator Placówki:</span>
                <span className="font-mono text-xs text-slate-600">{initialData.user.organizationId}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Zmiana Hasła */}
      <Card>
        <CardHeader>
          <CardTitle>Zmiana Hasła</CardTitle>
          <CardDescription>
            Hasło musi zawierać min. 8 znaków, w tym wielką literę, cyfrę oraz znak specjalny.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordSubmit}>
          <CardContent className="space-y-4">
            {passwordState.status === 'error' && (
              <div className="p-3 text-sm text-red-700 bg-red-50 rounded-md border border-red-200">
                {passwordState.message}
              </div>
            )}
            {passwordState.status === 'success' && (
              <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-md border border-emerald-200">
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
          <CardFooter>
            <Button type="submit" disabled={isPending || passwordState.status === 'loading'}>
              {passwordState.status === 'loading' ? 'Zmienianie hasła...' : 'Zmień hasło'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* 3. Sesje i Bezpieczeństwo */}
      <Card>
        <CardHeader>
          <CardTitle>Zarządzanie Sesjami i MFA</CardTitle>
          <CardDescription>
            Kontroluj urządzenia z aktywnym dostępem do Twojego konta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {sessionState.status === 'error' && (
            <div className="p-3 text-sm text-red-700 bg-red-50 rounded-md border border-red-200">
              {sessionState.message}
            </div>
          )}
          {sessionState.status === 'success' && (
            <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-md border border-emerald-200">
              {sessionState.message}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg bg-slate-50">
            <div>
              <h4 className="font-medium text-slate-900">Pozostałe aktywne urządzenia</h4>
              <p className="text-xs text-slate-500 mt-1">
                Wyloguj wszystkie sesje poza tą przeglądarką, jeśli podejrzewasz nieautoryzowany dostęp.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleSignOutOthers}
              disabled={isPending || sessionState.status === 'loading'}
            >
              {sessionState.status === 'loading' ? 'Wylogowywanie...' : 'Wyloguj inne sesje'}
            </Button>
          </div>

          <div className="p-4 border rounded-lg bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-slate-900">Uwierzytelnianie dwuskładnikowe (MFA / TOTP)</h4>
              <Badge variant={isStaffOrAdmin ? 'default' : 'secondary'}>
                {isStaffOrAdmin ? 'Wymagane dla personelu' : 'Opcjonalne'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Drugi składnik logowania zapewnia najwyższy poziom ochrony danych pensjonariuszy zgodnie z normami RODO Art. 9.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 4. Historia Bezpieczeństwa (4 stany UI) */}
      <Card>
        <CardHeader>
          <CardTitle>Ostatnie Zdarzenia Bezpieczeństwa</CardTitle>
          <CardDescription>Rejestr aktywności związanych z Twoim kontem.</CardDescription>
        </CardHeader>
        <CardContent>
          {initialData.logs.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500">
              Brak zarejestrowanych zdarzeń bezpieczeństwa w bieżącym okresie.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-sm">
              {initialData.logs.map((log) => (
                <div key={log.id} className="py-2.5 flex justify-between items-center">
                  <div>
                    <span className="font-medium text-slate-800">
                      {log.action === 'password_self_change' ? 'Samodzielna zmiana hasła' : log.action}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(log.created_at).toLocaleString('pl-PL')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
