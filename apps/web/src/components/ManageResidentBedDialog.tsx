'use client'

import { useState, useEffect } from 'react'
import { BedDouble, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

interface ManageResidentBedDialogProps {
  residentId: string
  currentBedLabel?: string
  currentRoomNumber?: string
}

interface BedAssignmentInfo {
  resident?: {
    id: string
    first_name?: string
    last_name?: string
  } | null
}

interface FacilityBedItem {
  id: string
  room_id: string
  label: string
  is_active: boolean
  active_assignment?: BedAssignmentInfo | null
}

interface FacilityRoomItem {
  id: string
  number: string
}

export function ManageResidentBedDialog({ residentId, currentBedLabel, currentRoomNumber }: ManageResidentBedDialogProps) {
  const [open, setOpen] = useState(false)
  const [bedId, setBedId] = useState('')
  const [beds, setBeds] = useState<FacilityBedItem[]>([])
  const [rooms, setRooms] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open && beds.length === 0) {
      const fetchData = async () => {
        setIsFetching(true)
        try {
          const [bedsRes, roomsRes] = await Promise.all([
            fetch('/api/facility/beds'),
            fetch('/api/facility/rooms')
          ])
          
          if (bedsRes.ok && roomsRes.ok) {
            const bedsData = await bedsRes.json()
            const roomsData = await roomsRes.json()
            
            const roomsMap: Record<string, string> = {}
            roomsData.rooms?.forEach((r: FacilityRoomItem) => {
              roomsMap[r.id] = r.number
            })
            
            setRooms(roomsMap)
            setBeds(bedsData.beds || [])
          }
        } catch (err) {
          console.error('Failed to fetch data', err)
        } finally {
          setIsFetching(false)
        }
      }
      fetchData()
    }
  }, [open, beds.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bedId) {
      setError('Wybierz łóżko z listy')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/facility/beds/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bed_id: bedId, resident_id: residentId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się przypisać łóżka')
      }

      setSuccess(true)
      setTimeout(() => {
        setOpen(false)
        window.location.reload()
      }, 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd')
    } finally {
      setIsLoading(false)
    }
  }

  // Get available beds
  const availableBeds = beds
    .filter((b) => b.is_active && (!b.active_assignment || b.active_assignment.resident?.id === residentId))
    .map((b) => ({
      ...b,
      roomNumber: rooms[b.room_id] || 'Nieznana',
    }))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" title="Zarządzaj łóżkiem" className="text-primary hover:bg-primary/10 h-8 w-8" />}>
        <BedDouble className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl md:max-w-2xl p-6">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Przypisz / Zmień Łóżko</DialogTitle>
            <DialogDescription>
              {currentBedLabel ? (
                <>Obecnie przypisano: <strong>Sala {currentRoomNumber}, łóżko {currentBedLabel}</strong>.</>
              ) : (
                <>Podopieczny nie ma przypisanego łóżka.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="text-sm font-medium text-destructive bg-destructive/10 p-2 rounded-md">{error}</div>
            )}
            {success && (
              <div className="text-sm font-medium text-foreground bg-muted p-2 rounded-md flex items-center gap-2">
                <Check className="h-4 w-4" /> Przypisano poprawnie!
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="bed">
                Nowe wolne łóżko
              </Label>
              <div>
                {isFetching ? (
                  <div className="text-sm text-muted-foreground py-2">Ładowanie wolnych łóżek...</div>
                ) : (
                  <NativeSelect
                    id="bed" className="flex w-full placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    value={bedId}
                    onChange={(e) => setBedId(e.target.value)}
                    required
                  >
                    <NativeSelectOption value="" disabled>Wybierz wolne łóżko</NativeSelectOption>
                    {availableBeds.map(b => (
                      <NativeSelectOption key={b.id} value={b.id}>
                        Sala {b.roomNumber} - Łóżko {b.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading || isFetching || success}>
              {isLoading ? 'Zapisywanie...' : 'Zapisz zmianę'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
