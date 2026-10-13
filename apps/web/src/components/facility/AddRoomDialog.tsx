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
      <DialogContent className="sm:max-w-lg md:max-w-xl p-6">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Dodaj nowy pokój</DialogTitle>
            <DialogDescription>
              Wprowadź dane nowego pokoju. Numer pokoju musi być unikalny.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="number">Numer pokoju</Label>
              <Input
                id="number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="np. 101 lub A-12"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="floor">Piętro</Label>
                <Input
                  id="floor"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  placeholder="np. 1"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sector">Sektor</Label>
                <Input
                  id="sector"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  placeholder="Opcjonalnie, np. Skrzydło A"
                />
              </div>
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
