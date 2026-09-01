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

interface AddRoomDialogProps {
  onRoomAdded: () => void
}

export default function AddRoomDialog({ onRoomAdded }: AddRoomDialogProps) {
  const [open, setOpen] = useState(false)
  const [number, setNumber] = useState('')
  const [floor, setFloor] = useState('')
  const [sector, setSector] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/facility/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ number, floor, sector }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się dodać pokoju')
      }

      setNumber('')
      setFloor('')
      setSector('')
      setOpen(false)
      onRoomAdded()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="w-4 h-4 mr-2" />
        Dodaj pokój
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Dodaj nowy pokój</DialogTitle>
            <DialogDescription>
              Wprowadź dane nowego pokoju. Numer pokoju musi być unikalny.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="number" className="text-right">
                Numer
              </Label>
              <Input
                id="number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="floor" className="text-right">
                Piętro
              </Label>
              <Input
                id="floor"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sector" className="text-right">
                Sektor
              </Label>
              <Input
                id="sector"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="col-span-3"
                placeholder="Opcjonalnie"
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
