'use client'

import { useState, useEffect } from 'react'
import { BedDouble, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AssignBedDialog from './AssignBedDialog'


interface BedListProps {
  roomId: string
  onUpdate: () => void
}

export default function BedList({ roomId, onUpdate }: BedListProps) {
  const [beds, setBeds] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchBeds = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/facility/beds?roomId=${roomId}`)
      if (res.ok) {
        const data = await res.json()
        setBeds(data.beds || [])
      }
    } catch (error) {
      console.error('Failed to fetch beds', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBeds()
  }, [roomId])

  const handleDeactivate = async (bedId: string, is_active: boolean) => {
    try {
      const res = await fetch('/api/facility/beds/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bed_id: bedId, is_active }),
      })
      if (res.ok) {
        fetchBeds()
        onUpdate()
      } else {
        const data = await res.json()
        alert(data.error)
      }
    } catch (error) {
      console.error(error)
      alert('Wystąpił błąd')
    }
  }

  const handleUnassign = async (bedId: string, residentId: string) => {
    if (!confirm('Czy na pewno chcesz wypisać tego pensjonariusza z łóżka?')) return

    try {
      const res = await fetch('/api/facility/beds/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bed_id: bedId, resident_id: residentId }),
      })
      if (res.ok) {
        fetchBeds()
        onUpdate()
      } else {
        const data = await res.json()
        alert(data.error)
      }
    } catch (error) {
      console.error(error)
      alert('Wystąpił błąd')
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-4">Ładowanie łóżek...</div>
  }

  if (beds.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 flex items-center bg-background rounded border border-dashed">
        <AlertCircle className="w-4 h-4 mr-2" />
        Brak łóżek w tym pokoju.
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {beds.map(bed => (
        <div key={bed.id} className={`p-4 rounded-lg border ${!bed.is_active ? 'opacity-50 bg-muted/50' : 'bg-background'}`}>
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center space-x-2">
              <BedDouble className="w-4 h-4 text-primary" />
              <span className="font-semibold">{bed.label}</span>
            </div>
            {!bed.is_active ? (
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground">Nieaktywne</span>
            ) : bed.active_assignment ? (
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-500 text-white">Zajęte</span>
            ) : (
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-green-600 border-green-600">Wolne</span>
            )}
          </div>

          <div className="mt-4 min-h-[60px]">
            {bed.active_assignment ? (
              <div className="text-sm">
                <div className="text-muted-foreground">Przypisano:</div>
                <div className="font-medium">
                  {bed.active_assignment.resident.first_name} {bed.active_assignment.resident.last_name}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Brak przypisania
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            {bed.is_active ? (
              <>
                {bed.active_assignment ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleUnassign(bed.id, bed.active_assignment.resident.id)}
                  >
                    Wypisz
                  </Button>
                ) : (
                  <AssignBedDialog bedId={bed.id} onAssigned={() => { fetchBeds(); onUpdate() }} />
                )}
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDeactivate(bed.id, false)}
                  disabled={!!bed.active_assignment}
                >
                  Dezaktywuj
                </Button>
              </>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleDeactivate(bed.id, true)}
                className="w-full"
              >
                Aktywuj łóżko
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
