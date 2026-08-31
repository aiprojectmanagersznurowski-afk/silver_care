'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'

type Resident = {
  id: string
  first_name: string
  last_name: string
}

export function InviteFamilyDialog({ residents }: { residents: Resident[] }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [residentId, setResidentId] = useState(residents[0]?.id || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !residentId) {
      setError('E-mail i przypisany pensjonariusz są wymagane.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/family/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), resident_id: residentId }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setEmail('')
        setOpen(false)
        window.location.reload()
      } else {
        setError(data.error || 'Wystąpił błąd.')
      }
    } catch {
      setError('Błąd sieci.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Zaproś członka rodziny</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zaproś rodzinę pensjonariusza</DialogTitle>
          <DialogDescription>
            Wygeneruj jednorazowy token dostępu, który połączony zostanie z podanym pensjonariuszem.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resident">Pensjonariusz</Label>
            <select
              id="resident"
              value={residentId}
              onChange={(e) => setResidentId(e.target.value)}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              {residents.map(r => (
                <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Adres e-mail członka rodziny</Label>
            <Input
              id="email"
              type="email"
              placeholder="np. jan.kowalski@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || residents.length === 0}>
              {isSubmitting ? 'Wysyłanie...' : 'Wygeneruj i wyślij'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
