'use client'

import { useState, useEffect } from 'react'
import { UserPlus } from 'lucide-react'
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

interface AssignBedDialogProps {
  bedId: string
  onAssigned: () => void
}

export default function AssignBedDialog({ bedId, onAssigned }: AssignBedDialogProps) {
  const [open, setOpen] = useState(false)
  const [residentId, setResidentId] = useState('')
  const [residents, setResidents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && residents.length === 0) {
      const fetchResidents = async () => {
        setIsFetching(true)
        try {
          const res = await fetch('/api/residents')
          if (res.ok) {
            const data = await res.json()
            setResidents(data.residents || [])
          }
        } catch (err) {
          console.error('Failed to fetch list', err)
        } finally {
          setIsFetching(false)
        }
      }
      fetchResidents()
    }
  }, [open, residents.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!residentId) {
      setError('Wybierz pensjonariusza')
      return
    }

    setIsLoading(true)
    setError(null)

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
        throw new Error(data.error || 'Nie udało się przypisać pensjonariusza')
      }

      setResidentId('')
      setOpen(false)
      onAssigned()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="w-4 h-4 mr-2" />
          Przypisz
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Przypisz pensjonariusza</DialogTitle>
            <DialogDescription>
              Wybierz pensjonariusza z listy, aby przypisać go do tego łóżka.
              Jeżeli ma on przypisanie do innego łóżka, zostanie przeniesiony.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="resident" className="text-right">
                Pensjonariusz
              </Label>
              <div className="col-span-3">
                {isFetching ? (
                  <div className="text-sm text-muted-foreground">Ładowanie...</div>
                ) : (
                  <select
                    id="resident"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={residentId}
                    onChange={(e) => setResidentId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Wybierz z listy</option>
                    {residents.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.first_name} {r.last_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading || isFetching}>
              {isLoading ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
