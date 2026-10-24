'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { RowActions } from '@/components/patterns/RowActions'
import AddBedDialog from './AddBedDialog'

/** Akcje pokoju w menu „⋯" w tabeli pokoi. */
export function RoomRowActions({ roomId, onBedAdded }: { roomId: string; onBedAdded: () => void }) {
  const [adding, setAdding] = useState(false)

  return (
    <RowActions label="Pokój" actions={[{ label: 'Dodaj łóżko', icon: Plus, onSelect: () => setAdding(true) }]}>
      {adding && <AddBedDialog roomId={roomId} onBedAdded={onBedAdded} open onOpenChange={setAdding} />}
    </RowActions>
  )
}
