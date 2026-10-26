'use client'

import { useState, type ComponentProps } from 'react'
import { Pencil, UserCircle2 } from 'lucide-react'
import { ResidentEditSheet } from '@/components/ResidentEditSheet'
import { RowActions } from '@/components/patterns/RowActions'
import { formatPersonName } from '@/lib/person-name'

type Resident = ComponentProps<typeof ResidentEditSheet>['resident']

/** Akcje podopiecznego w menu „⋯" — te same w tabeli i w kafelku. */
export function ResidentRowActions({ resident }: { resident: Resident }) {
  const [editing, setEditing] = useState(false)

  return (
    <RowActions
      label={formatPersonName(resident.first_name, resident.last_name)}
      actions={[
        { label: 'Profil 360°', icon: UserCircle2, href: `/admin/residents/${resident.id}` },
        { label: 'Edytuj dane', icon: Pencil, onSelect: () => setEditing(true) },
      ]}
    >
      {editing && <ResidentEditSheet resident={resident} open onOpenChange={setEditing} />}
    </RowActions>
  )
}
