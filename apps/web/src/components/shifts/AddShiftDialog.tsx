'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { createShiftDefinitionAction } from '@/actions/shifts'

/** Dodanie zmiany placówki (NUR-SHIFT-CONFIG). Zmiana, której koniec nie jest później niż początek, przechodzi przez północ. */
export function AddShiftDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [startTime, setStartTime] = useState('07:00')
  const [endTime, setEndTime] = useState('19:00')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await createShiftDefinitionAction({ name, startTime, endTime })
    setSaving(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setOpen(false)
    setName('')
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null) }}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Dodaj zmianę
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg p-6">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nowa zmiana</DialogTitle>
            <DialogDescription>
              Podaj nazwę i godziny. Gdy koniec jest wcześniejszy niż początek, zmiana przechodzi przez północ. Godziny w strefie Europe/Warsaw.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div data-testid="shift-form-error" role="alert" className="text-sm font-medium text-destructive">{error}</div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="shift-name">Nazwa zmiany</Label>
              <Input id="shift-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Zmiana dzienna" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="shift-start">Początek</Label>
                <Input id="shift-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shift-end">Koniec</Label>
                <Input id="shift-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? 'Zapisywanie...' : 'Zapisz zmianę'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
