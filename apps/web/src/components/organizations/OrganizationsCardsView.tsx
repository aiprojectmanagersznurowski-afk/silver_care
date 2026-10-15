'use client'

import React from 'react'
import Link from 'next/link'
import {
  Building2,
  Users,
  UserCog,
  UserCheck,
  Calendar,
  MapPin,
  ChevronRight,
} from 'lucide-react'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { EditOrganizationDialog } from '@/components/EditOrganizationDialog'
import { OrganizationSummaryItem } from './organizations-types'

export function OrganizationsCardsView({
  organizations
}: {
  organizations: OrganizationSummaryItem[]
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {organizations.map((org) => {
        const occupancyPercent = org.resident_limit > 0
          ? Math.round((org.active_resident_count / org.resident_limit) * 100)
          : 0

        return (
          <div
            key={org.organization_id}
            className="group block rounded-xl bg-card p-6 ring-1 ring-border hover:ring-primary transition-all"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <Link
                    href={`/admin/organizations/${org.organization_id}`}
                    className="text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate"
                  >
                    {org.organization_name}
                  </Link>
                  <BusinessIdBadge type="organization" id={org.organization_id} />
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground pl-11 truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{org.address || 'Brak podanego adresu'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <EditOrganizationDialog organization={org} />
                <Link
                  href={`/admin/organizations/${org.organization_id}`}
                  className="flex items-center gap-1 rounded-lg bg-muted/50 px-2.5 py-1 text-sm font-medium text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors min-h-11"
                >
                  <span>Szczegóły</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border grid grid-cols-3 gap-4 text-center">
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>Podopieczni</span>
                </div>
                <div className="text-base font-bold text-foreground">
                  {org.active_resident_count}
                  <span className="text-sm font-normal text-muted-foreground"> / {org.resident_limit}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">{occupancyPercent}% limitu</div>
              </div>

              <div className="bg-muted/50 rounded-xl p-3">
                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />
                  <span>Personel</span>
                </div>
                <div className="text-base font-bold text-foreground">
                  {org.staff_count}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">Opiekunowie</div>
              </div>

              <div className="bg-muted/50 rounded-xl p-3">
                <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1">
                  <UserCog className="h-3.5 w-3.5 text-primary" />
                  <span>Admini</span>
                </div>
                <div className="text-base font-bold text-foreground">
                  {org.administrator_count}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">Org Admini</div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>W systemie od: {new Date(org.created_at).toLocaleDateString('pl-PL')}</span>
              </div>
              <BusinessIdBadge type="organization" id={org.organization_id} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
