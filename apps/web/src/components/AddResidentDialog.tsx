'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'

export function AddResidentDialog() {
  const [open, setOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [pesel, setPesel] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !pesel.trim()) {
      setError('Imię, nazwisko i PESEL są wymagane.')
      return
    }
    
    // Prosta walidacja długości PESEL
    if (pesel.trim().length !== 11 || !/^\d+$/.test(pesel.trim())) {
      setError('PESEL musi składać się z 11 cyfr.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    let avatar_url = null
    if (avatarFile) {
      try {
        const supabase = createClient()
        const fileExt = avatarFile.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
        const filePath = `residents/${fileName}`
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile)
          
        if (uploadError) throw uploadError
        
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath)
          
        avatar_url = publicUrl
      } catch (err) {
        setError('Wystąpił błąd podczas wgrywania zdjęcia.')
        setIsSubmitting(false)
        return
      }
    }

    try {
      const res = await fetch('/api/residents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          first_name: firstName.trim(), 
          last_name: lastName.trim(),
          pesel: pesel.trim(),
          avatar_url
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setFirstName('')
        setLastName('')
        setPesel('')
        setAvatarFile(null)
        setOpen(false)
        // Refresh the page to show new resident
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
      <DialogTrigger render={<Button />}>
        Dodaj pensjonariusza
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nowy pensjonariusz</DialogTitle>
          <DialogDescription>
            Wpisz dane nowego podopiecznego. Zostanie dodany do Twojej placówki.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">Imię</Label>
            <Input
              id="firstName"
              placeholder="np. Jan"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Nazwisko</Label>
            <Input
              id="lastName"
              placeholder="np. Kowalski"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pesel">PESEL</Label>
            <Input
              id="pesel"
              placeholder="np. 45010112345"
              value={pesel}
              onChange={(e) => setPesel(e.target.value)}
              required
              maxLength={11}
            />
            <p className="text-xs text-text-tertiary">
              PESEL jest szyfrowany i używany wyłącznie do identyfikacji i połączenia z danymi medycznymi.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatar">Zdjęcie (opcjonalnie)</Label>
            <Input
              id="avatar"
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
              className="cursor-pointer file:cursor-pointer"
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Dodawanie...' : 'Dodaj'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
