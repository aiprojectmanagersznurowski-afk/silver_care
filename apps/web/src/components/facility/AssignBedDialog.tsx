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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

interface AssignBedDialogProps {
  bedId: string
  onAssigned: () => void
}

interface AssignableResident {
  id: string
  first_name: string
  last_name: string
}

export default function AssignBedDialog({ bedId, onAssigned }: AssignBedDialogProps) {
  const [open, setOpen] = useState(false)
  const [residentId, setResidentId] = useState('')
  const [residents, setResidents] = useState<AssignableResident[]>([])
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="h-8 text-sm" />}>
        <UserPlus className="w-3.5 h-3.5 mr-1.5" />
        Przypisz
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg md:max-w-xl p-6">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Przypisz pensjonariusza</DialogTitle>
            <DialogDescription>
              Wybierz pensjonariusza z listy, aby przypisać go do tego łóżka.
              Jeżeli ma on przypisanie do innego łóżka, zostanie przeniesiony.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="resident">
                Pensjonariusz
              </Label>
              <div>
                {isFetching ? (
                  <div className="text-sm text-muted-foreground py-2">Ładowanie pensjonariuszy...</div>
                ) : (
                  <NativeSelect
                    id="resident" className="flex w-full placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    value={residentId}
                    onChange={(e) => setResidentId(e.target.value)}
                    required
                  >
                    <NativeSelectOption value="" disabled>Wybierz z listy</NativeSelectOption>
                    {residents.map(r => (
                      <NativeSelectOption key={r.id} value={r.id}>
                        {r.first_name} {r.last_name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
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
