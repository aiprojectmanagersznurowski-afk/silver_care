'use client'

import React from 'react'
import Link from 'next/link'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { OrganizationRowActions } from './OrganizationRowActions'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/patterns/TableCard'
import { OrganizationSummaryItem } from './organizations-types'
import { useTableSort } from '@/hooks/use-table-sort'
import { SortableTableHead } from '@/components/patterns/SortableTableHead'

const occupancy = (o: OrganizationSummaryItem) => (o.resident_limit > 0 ? o.active_resident_count / o.resident_limit : 0)

const ORG_SORT_ACCESSORS = {
  name: (o: OrganizationSummaryItem) => o.organization_name,
  address: (o: OrganizationSummaryItem) => o.address,
  limit: (o: OrganizationSummaryItem) => o.resident_limit,
  occupancy,
  staff: (o: OrganizationSummaryItem) => o.staff_count,
  created: (o: OrganizationSummaryItem) => (o.created_at ? new Date(o.created_at) : null),
}

export function OrganizationsTableView({
  organizations
}: {
  organizations: OrganizationSummaryItem[]
}) {
  const { sorted, sort, toggleSort } = useTableSort(organizations, ORG_SORT_ACCESSORS, { key: 'name', direction: 'asc' })

  return (
    <TableCard>
      <Table>
        <TableHeader className="text-muted-foreground">
          <TableRow>
            <SortableTableHead sortKey="name" sort={sort} onSort={toggleSort}>Nazwa</SortableTableHead>
            <SortableTableHead sortKey="address" sort={sort} onSort={toggleSort}>Adres</SortableTableHead>
            <SortableTableHead sortKey="limit" sort={sort} onSort={toggleSort} className="text-center">Limit</SortableTableHead>
            <SortableTableHead sortKey="occupancy" sort={sort} onSort={toggleSort} className="text-center">Obłożenie</SortableTableHead>
            <SortableTableHead sortKey="staff" sort={sort} onSort={toggleSort} className="text-center">Personel</SortableTableHead>
            <SortableTableHead sortKey="created" sort={sort} onSort={toggleSort}>Utworzono</SortableTableHead>
            <TableHead className="text-right">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((org) => {
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
                    {org.over_capacity_limit && <StatusBadge tone="brand">Ponad limit</StatusBadge>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[220px] truncate">
                  {org.address || '—'}
                </TableCell>
                <TableCell className="text-center font-medium">
                  {org.resident_limit}
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-semibold text-sm text-foreground">
                    {org.active_resident_count} / {org.resident_limit}
                  </span>
                  <span className="ml-1 text-sm text-muted-foreground">({occupancyPercent}%)</span>
                  <div className="text-sm text-muted-foreground">łóżka: {org.active_bed_count}</div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-medium text-foreground">{org.staff_count}</span>
                  <span className="ml-1 text-sm text-muted-foreground">({org.administrator_count} adm.)</span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(org.created_at).toLocaleDateString('pl-PL')}
                </TableCell>
                <TableCell className="text-right">
                  <OrganizationRowActions org={org} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableCard>
  )
}
