'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Users, UserCog, UserCheck, Calendar, MapPin, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'

export interface OrganizationSummaryItem {
  organization_id: string
  organization_name: string
  address?: string | null
  resident_limit: number
  created_at: string
  active_resident_count: number
  staff_count: number
  administrator_count: number
}

interface OrganizationsManagementClientProps {
  initialOrganizations: OrganizationSummaryItem[]
  errorMessage?: string
  forcedState?: 'loading' | 'empty' | 'success' | 'error'
  renderActionSlot?: React.ReactNode
}

export function OrganizationsManagementClient({
  initialOrganizations,
  errorMessage,
  forcedState,
  renderActionSlot
}: OrganizationsManagementClientProps) {
  const organizations = initialOrganizations

  const currentState = forcedState || (errorMessage ? 'error' : organizations.length === 0 ? 'empty' : 'success')

  // 1. Stan LOADING
  if (currentState === 'loading') {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Ładowanie listy placówek">
        <div className="h-10 w-72 rounded-xl bg-slate/10" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-56 rounded-2xl bg-slate/10" />
          <div className="h-56 rounded-2xl bg-slate/10" />
        </div>
      </div>
    )
  }

  // 2. Stan ERROR
  if (currentState === 'error') {
    return (
      <Card className="rounded-2xl border-destructive/20 bg-destructive/5 p-8 text-center" role="alert">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-semibold text-slate mb-2">Błąd wczytywania placówek</h3>
        <p className="text-slate-soft max-w-md mx-auto mb-6">
          {errorMessage || 'Wystąpił problem podczas pobierania podsumowania organizacji.'}
        </p>
        <Button
          onClick={() => window.location.reload()}
          className="min-h-[48px] rounded-xl px-6 bg-slate text-white hover:bg-slate/90"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Spróbuj ponownie
        </Button>
      </Card>
    )
  }

  // 3. Stan EMPTY
  if (currentState === 'empty') {
    return (
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5 p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sage/10 text-sage mb-4">
          <Building2 className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-semibold text-slate mb-2">Brak zarejestrowanych placówek</h3>
        <p className="text-slate-soft max-w-md mx-auto mb-6">
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

  // 4. Stan SUCCESS
  return (
    <div className="space-y-6">
      {renderActionSlot && (
        <div className="flex justify-end">
          {renderActionSlot}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {organizations.map((org) => {
          const occupancyPercent = org.resident_limit > 0
            ? Math.round((org.active_resident_count / org.resident_limit) * 100)
            : 0

          return (
            <Link
              key={org.organization_id}
              href={`/admin/organizations/${org.organization_id}`}
              className="group block rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate/10 hover:ring-sage transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sage/10 text-sage">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <h3 className="text-lg font-bold text-slate group-hover:text-sage transition-colors">
                      {org.organization_name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-soft pl-11">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>{org.address || 'Brak podanego adresu'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 rounded-lg bg-slate/5 px-2.5 py-1 text-xs font-medium text-slate-soft group-hover:bg-sage/10 group-hover:text-sage transition-colors">
                  <span>Szczegóły</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate/5 grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate/5 rounded-xl p-3">
                  <div className="flex items-center justify-center gap-1 text-xs text-slate-soft mb-1">
                    <Users className="h-3.5 w-3.5 text-sage" />
                    <span>Podopieczni</span>
                  </div>
                  <div className="text-base font-bold text-slate">
                    {org.active_resident_count}
                    <span className="text-xs font-normal text-slate-soft"> / {org.resident_limit}</span>
                  </div>
                  <div className="text-[10px] text-slate-soft mt-0.5">{occupancyPercent}% limitu</div>
                </div>

                <div className="bg-slate/5 rounded-xl p-3">
                  <div className="flex items-center justify-center gap-1 text-xs text-slate-soft mb-1">
                    <UserCheck className="h-3.5 w-3.5 text-sage" />
                    <span>Personel</span>
                  </div>
                  <div className="text-base font-bold text-slate">
                    {org.staff_count}
                  </div>
                  <div className="text-[10px] text-slate-soft mt-0.5">Opiekunowie</div>
                </div>

                <div className="bg-slate/5 rounded-xl p-3">
                  <div className="flex items-center justify-center gap-1 text-xs text-slate-soft mb-1">
                    <UserCog className="h-3.5 w-3.5 text-sage" />
                    <span>Admini</span>
                  </div>
                  <div className="text-base font-bold text-slate">
                    {org.administrator_count}
                  </div>
                  <div className="text-[10px] text-slate-soft mt-0.5">Org Admini</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-soft">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>W systemie od: {new Date(org.created_at).toLocaleDateString('pl-PL')}</span>
                </div>
                <BusinessIdBadge type="organization" id={org.organization_id} />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
