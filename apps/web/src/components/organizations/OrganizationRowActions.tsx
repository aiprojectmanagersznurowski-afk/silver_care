'use client'

import { useState } from 'react'
import { Eye, Pencil } from 'lucide-react'
import { EditOrganizationDialog } from '@/components/EditOrganizationDialog'
import { RowActions } from '@/components/patterns/RowActions'
import type { OrganizationSummaryItem } from './organizations-types'

/** Akcje placówki w menu „⋯" — te same w tabeli i w kafelku. */
export function OrganizationRowActions({ org }: { org: OrganizationSummaryItem }) {
  const [editing, setEditing] = useState(false)

  return (
    <RowActions
      label="Placówka"
      actions={[
        { label: 'Szczegóły', icon: Eye, href: `/admin/organizations/${org.organization_id}` },
        { label: 'Edytuj', icon: Pencil, onSelect: () => setEditing(true) },
      ]}
    >
      {editing && <EditOrganizationDialog organization={org} open onOpenChange={setEditing} />}
    </RowActions>
  )
}
