'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { EditOrganizationDialog } from '@/components/EditOrganizationDialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { OrganizationSummaryItem } from './organizations-types'

export function OrganizationsTableView({
  organizations
}: {
  organizations: OrganizationSummaryItem[]
}) {
  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-border">
      <Table>
        <TableHeader className="text-muted-foreground">
          <TableRow>
            <TableHead>Nazwa</TableHead>
            <TableHead>Adres</TableHead>
            <TableHead className="text-center">Limit</TableHead>
            <TableHead className="text-center">Obłożenie</TableHead>
            <TableHead className="text-center">Personel</TableHead>
            <TableHead>Utworzono</TableHead>
            <TableHead className="text-right">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.map((org) => {
            const occupancyPercent = org.resident_limit > 0
              ? Math.round((org.active_resident_count / org.resident_limit) * 100)
              : 0

            return (
              <TableRow key={org.organization_id} className="hover:bg-muted/30">
                <TableCell>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/admin/organizations/${org.organization_id}`}
                      className="font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      {org.organization_name}
                    </Link>
                    <BusinessIdBadge type="organization" id={org.organization_id} />
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[220px] truncate">
                  {org.address || '—'}
                </TableCell>
                <TableCell className="text-center font-medium">
                  {org.resident_limit}
                </TableCell>
                <TableCell className="text-center">
                  <div className="font-semibold text-sm text-foreground">
                    {org.active_resident_count} / {org.resident_limit}
                  </div>
                  <div className="text-sm text-muted-foreground">{occupancyPercent}%</div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-medium text-foreground">{org.staff_count}</span>
                  <span className="text-sm text-muted-foreground block">({org.administrator_count} adm.)</span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(org.created_at).toLocaleDateString('pl-PL')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <EditOrganizationDialog organization={org} />
                    <Link
                      href={`/admin/organizations/${org.organization_id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors min-h-11"
                    >
                      Szczegóły
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
