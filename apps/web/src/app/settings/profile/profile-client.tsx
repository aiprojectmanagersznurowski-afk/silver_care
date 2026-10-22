'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { ProfilePasswordCard } from '@/components/profile/ProfilePasswordCard'
import { ProfileSessionsCard } from '@/components/profile/ProfileSessionsCard'
import { ProfileData, ROLE_LABELS } from '@/components/profile/profile-types'
import { StatusBadge } from '@/components/patterns/StatusBadge'

export type { ProfileData }

export function ProfileSecurityClient({ initialData }: { initialData: ProfileData }) {
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
              <span className="text-muted-foreground block">Adres E-mail:</span>
              <span className="font-medium text-foreground">{initialData.user.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Rola w systemie:</span>
              <div className="mt-1">
                <StatusBadge>{ROLE_LABELS[initialData.user.role] || initialData.user.role}</StatusBadge>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground block">Identyfikator konta:</span>
              <div className="mt-1">
                <BusinessIdBadge type="user" id={initialData.user.id} />
              </div>
            </div>
            {initialData.user.organizationId && (
              <div>
                <span className="text-muted-foreground block">Identyfikator placówki:</span>
                <div className="mt-1">
                  <BusinessIdBadge type="organization" id={initialData.user.organizationId} />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Zmiana Hasła */}
      <ProfilePasswordCard />

      {/* 3. Sesje i Bezpieczeństwo — MFA: Planowane w kolejnym wydaniu */}
      <ProfileSessionsCard />

      {/* 4. Historia Bezpieczeństwa (4 stany UI) */}
      <Card>
        <CardHeader>
          <CardTitle>Ostatnie Zdarzenia Bezpieczeństwa</CardTitle>
          <CardDescription>Rejestr aktywności związanych z Twoim kontem.</CardDescription>
        </CardHeader>
        <CardContent>
          {initialData.logs.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Brak zarejestrowanych zdarzeń bezpieczeństwa w bieżącym okresie.
            </div>
          ) : (
            <div className="divide-y divide-border text-sm">
              {initialData.logs.map((log) => (
                <div key={log.id} className="py-2.5 flex justify-between items-center">
                  <div>
                    <span className="font-medium text-foreground">
                      {log.action === 'password_self_change' ? 'Samodzielna zmiana hasła' : log.action}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {log.created_at ? new Date(log.created_at).toLocaleString('pl-PL') : '—'}
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
