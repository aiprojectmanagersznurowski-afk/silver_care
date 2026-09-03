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

interface ManageResidentBedDialogProps {
  residentId: string
  currentBedLabel?: string
  currentRoomNumber?: string
}

export function ManageResidentBedDialog({ residentId, currentBedLabel, currentRoomNumber }: ManageResidentBedDialogProps) {
  const [open, setOpen] = useState(false)
  const [bedId, setBedId] = useState('')
  const [rooms, setRooms] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open && rooms.length === 0) {
      const fetchRooms = async () => {
        setIsFetching(true)
        try {
          const res = await fetch('/api/facility/rooms')
          if (res.ok) {
            const data = await res.json()
            setRooms(data.rooms || [])
          }
        } catch (err) {
          console.error('Failed to fetch rooms', err)
        } finally {
          setIsFetching(false)
        }
      }
      fetchRooms()
    }
  }, [open, rooms.length])

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
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Get available beds from fetched rooms
  const availableBeds = rooms.flatMap((r: any) => 
    (r.bed_list || []).filter((b: any) => b.is_active && (!b.active_assignment || b.active_assignment.resident?.id === residentId))
      .map((b: any) => ({
        ...b,
        roomNumber: r.number,
      }))
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" title="Zarządzaj łóżkiem" className="text-sage hover:bg-sage/10 h-8 w-8" />}>
        <BedDouble className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Przypisz / Zmień Łóżko</DialogTitle>
            <DialogDescription>
              {currentBedLabel ? (
                <>Obecnie przypisano: <strong>Sala {currentRoomNumber}, łóżko {currentBedLabel}</strong>.</>
              ) : (
                <>Pensjonariusz nie ma przypisanego łóżka.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="text-sm font-medium text-destructive bg-destructive/10 p-2 rounded-md">{error}</div>
            )}
            {success && (
              <div className="text-sm font-medium text-green-600 bg-green-50 p-2 rounded-md flex items-center gap-2">
                <Check className="h-4 w-4" /> Przypisano poprawnie!
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bed" className="text-right">
                Nowe łóżko
              </Label>
              <div className="col-span-3">
                {isFetching ? (
                  <div className="text-sm text-muted-foreground">Ładowanie wolnych łóżek...</div>
                ) : (
                  <select
                    id="bed"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={bedId}
                    onChange={(e) => setBedId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Wybierz wolne łóżko</option>
                    {availableBeds.map(b => (
                      <option key={b.id} value={b.id}>
                        Sala {b.roomNumber} - Łóżko {b.label}
                      </option>
                    ))}
                  </select>
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
