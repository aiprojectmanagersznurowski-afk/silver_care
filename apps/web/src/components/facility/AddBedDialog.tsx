'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AddBedDialogProps {
  roomId: string
  onBedAdded: () => void
  /** Sterowanie z zewnątrz (np. z menu „⋯") — wtedy bez własnego przycisku. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export default function AddBedDialog({ roomId, onBedAdded, open: openProp, onOpenChange }: AddBedDialogProps) {
  const [innerOpen, setInnerOpen] = useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : innerOpen
  const setOpen = (next: boolean) => (controlled ? onOpenChange?.(next) : setInnerOpen(next))
  const [label, setLabel] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // ADM-CAPACITY-LIMIT: ostrzeżenie o przekroczeniu limitu miejsc, zapis dopiero po potwierdzeniu
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null)

  const submitBed = async (confirmCapacityExceed: boolean) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/facility/beds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ room_id: roomId, label, confirm_capacity_exceed: confirmCapacityExceed }),
      })

      const data = await res.json()

      if (res.status === 409 && data.code === 'CAPACITY_LIMIT_EXCEEDED') {
        setCapacityWarning(data.error)
        return
      }
      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się dodać łóżka')
      }

      setLabel('')
      setCapacityWarning(null)
      setOpen(false)
      onBedAdded()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void submitBed(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <Plus className="w-4 h-4 mr-2" />
          Dodaj łóżko
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg md:max-w-xl p-6">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Dodaj nowe łóżko</DialogTitle>
            <DialogDescription>
              Wprowadź oznaczenie łóżka (np. A, B, C lub 1, 2, 3).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}
            {capacityWarning && (
              <div
                data-testid="capacity-limit-warning"
                role="alert"
                className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground space-y-2"
              >
                <p className="font-semibold">Przekroczenie limitu miejsc</p>
                <p className="text-muted-foreground">{capacityWarning}</p>
                <p className="text-muted-foreground">
                  Limit ustala Administrator platformy. Po zatwierdzeniu przekroczenie zostanie odnotowane w rejestrze audytowym.
                </p>
                <Button type="button" variant="outline" disabled={isLoading} onClick={() => void submitBed(true)}>
                  Dodaj mimo przekroczenia limitu
                </Button>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="label">Oznaczenie łóżka</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="np. A, B lub 1, 2"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
