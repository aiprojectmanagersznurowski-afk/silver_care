'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { BedItem } from './bed-types'
import { BedTableRow } from './BedTableRow'
import { TableCard } from '@/components/patterns/TableCard'
import { ListEmpty, ListError, ListLoading } from '@/components/patterns/ListState'

interface BedListProps {
  roomId: string
  roomNumber?: string
  floor?: string
  onUpdate: () => void
}

export default function BedList({ roomId, roomNumber, floor, onUpdate }: BedListProps) {
  const [beds, setBeds] = useState<BedItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [unassignTarget, setUnassignTarget] = useState<{
    bedId: string
    residentId: string
    residentName: string
  } | null>(null)
  const [isUnassigning, setIsUnassigning] = useState(false)

  const fetchBeds = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/facility/beds?roomId=${roomId}`)
      setLoadFailed(!res.ok)
      if (res.ok) {
        const data = await res.json()
        setBeds(data.beds || [])
      }
    } catch (error) {
      setLoadFailed(true)
      console.error('Failed to fetch beds', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => fetchBeds())
  }, [roomId])

  const handleDeactivate = async (bedId: string, is_active: boolean) => {
    try {
      const res = await fetch('/api/facility/beds/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bed_id: bedId, is_active }),
      })
      if (res.ok) {
        toast.success(is_active ? 'Łóżko zostało aktywowane' : 'Łóżko zostało dezaktywowane')
        fetchBeds()
        onUpdate()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Nie udało się zmienić statusu łóżka')
      }
    } catch (error) {
      console.error(error)
      toast.error('Wystąpił błąd połączenia z serwerem')
    }
  }

  const executeUnassign = async () => {
    if (!unassignTarget) return
    setIsUnassigning(true)
    try {
      const res = await fetch('/api/facility/beds/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bed_id: unassignTarget.bedId, resident_id: unassignTarget.residentId }),
      })
      if (res.ok) {
        toast.success('Pensjonariusz został pomyślnie wypisany z łóżka')
        setUnassignTarget(null)
        fetchBeds()
        onUpdate()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Nie udało się wypisać pensjonariusza')
      }
    } catch (error) {
      console.error(error)
      toast.error('Wystąpił błąd połączenia z serwerem')
    } finally {
      setIsUnassigning(false)
    }
  }

  if (isLoading) {
    return <ListLoading label="Wczytywanie łóżek" rows={2} />
  }

  if (loadFailed) {
    return <ListError description="Nie udało się pobrać listy łóżek tego pokoju. Spróbuj ponownie za chwilę." />
  }

  if (beds.length === 0) {
    return <ListEmpty title="Brak łóżek w tym pokoju" description="Dodaj łóżko w ustawieniach pokoju." />
  }

  return (
    <>
      <div data-testid="beds-table">
      <TableCard>
        <Table>
          <TableHeader className="bg-muted/50 font-semibold text-muted-foreground">
            <TableRow>
              <TableHead className="w-[120px]">Łóżko</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead>Pensjonariusz</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {beds.map((bed) => (
              <BedTableRow
                key={bed.id}
                bed={bed}
                roomNumber={roomNumber}
                floor={floor}
                onDeactivate={handleDeactivate}
                onUnassignClick={setUnassignTarget}
                onRefresh={() => {
                  fetchBeds()
                  onUpdate()
                }}
              />
            ))}
          </TableBody>
        </Table>
      </TableCard>
      </div>

      <ConfirmDialog
        open={!!unassignTarget}
        onOpenChange={(open) => { if (!open) setUnassignTarget(null) }}
        title="Wypisanie pensjonariusza z łóżka"
        description={unassignTarget ? `Czy na pewno chcesz wypisać pensjonariusza (${unassignTarget.residentName}) z tego łóżka? Miejsce w pokoju zostanie natychmiast zwolnione.` : undefined}
        confirmLabel="Wypisz z łóżka"
        cancelLabel="Anuluj"
        variant="destructive"
        loading={isUnassigning}
        onConfirm={executeUnassign}
      />
    </>
  )
}
