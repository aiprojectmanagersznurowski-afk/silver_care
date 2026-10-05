'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

type Resident = {
  id: string
  first_name: string
  last_name: string
}

export function InviteFamilyDialog({ residents }: { residents: Resident[] }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState('48')
  const [residentId, setResidentId] = useState(residents[0]?.id || '')
  const [familyRole, setFamilyRole] = useState<'legal_guardian' | 'family'>('legal_guardian')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !residentId) {
      setError('E-mail i przypisany pensjonariusz są wymagane.')
      return
    }

    let finalPhone = ''
    if (phone.trim()) {
      // Usunięcie wszystkich znaków niebędących cyframi
      const cleanPhone = phone.replace(/\D/g, '')
      if (cleanPhone.length < 7) {
        setError('Podany numer telefonu wydaje się zbyt krótki.')
        return
      }
      finalPhone = `${countryCode}${cleanPhone}`
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/family/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), phone: finalPhone, resident_id: residentId, role: familyRole }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setGeneratedUrl(data.url)
        setEmail('')
        setPhone('')
        setFamilyRole('legal_guardian')
        // setOpen(false) 
        // window.location.reload() // Usunięte by użytkownik zobaczył link
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
        Zaproś członka rodziny
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
            <NativeSelect
              id="resident"
              value={residentId}
              onChange={(e) => setResidentId(e.target.value)} className="flex w-full items-center justify-between disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              {residents.map(r => (
                <NativeSelectOption key={r.id} value={r.id}>{r.first_name} {r.last_name}</NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="family-role">Rola i uprawnienia</Label>
            <NativeSelect
              id="family-role"
              value={familyRole}
              onChange={(e) => setFamilyRole(e.target.value as 'legal_guardian' | 'family')} className="flex w-full items-center justify-between disabled:cursor-not-allowed disabled:opacity-50"
            >
              <NativeSelectOption value="legal_guardian">Opiekun prawny (pełne uprawnienia, zgody Art. 9)</NativeSelectOption>
              <NativeSelectOption value="family">Obserwator (tylko wgląd w raporty, brak zgód Art. 9)</NativeSelectOption>
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              Zgodnie z RODO (Art. 9) wyłącznie pensjonariusz lub opiekun prawny może decydować o przetwarzaniu danych szczególnych kategorii. Obserwator posiada wyłącznie wgląd do publikowanych raportów.
            </p>
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
          <div className="space-y-2">
            <Label htmlFor="phone">Numer telefonu (opcjonalnie do powiadomień SMS)</Label>
            <div className="flex gap-2">
              <NativeSelect
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)} className="flex w-[120px] items-center justify-between"
              >
                <NativeSelectOption value="48">🇵🇱 +48</NativeSelectOption>
                <NativeSelectOption value="44">🇬🇧 +44</NativeSelectOption>
                <NativeSelectOption value="49">🇩🇪 +49</NativeSelectOption>
                <NativeSelectOption value="380">🇺🇦 +380</NativeSelectOption>
                <NativeSelectOption value="1">🇺🇸 +1</NativeSelectOption>
              </NativeSelect>
              <Input
                id="phone"
                type="tel"
                placeholder="np. 123 456 789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">Podaj numer bez początkowego zera (np. 123456789).</p>
          </div>
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
          {generatedUrl && (
            <div className="mt-4 p-4 border border-green-500/30 bg-green-500/10 rounded-md space-y-2">
              <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                Zaproszenie wygenerowane pomyślnie!
              </p>
              <p className="text-xs text-muted-foreground">
                Wyślij poniższy link rodzinie pensjonariusza, aby umożliwić założenie konta:
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Input readOnly value={generatedUrl} className="text-xs font-mono h-8" />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="h-8"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedUrl)
                    toast.success('Link zaproszenia skopiowano do schowka!')
                  }}
                >
                  Kopiuj
                </Button>
              </div>
              <Button 
                type="button" 
                variant="default" 
                className="w-full mt-2" 
                onClick={() => {
                  setOpen(false)
                  window.location.reload()
                }}
              >
                Zamknij i odśwież
              </Button>
            </div>
          )}

          {!generatedUrl && (
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting || residents.length === 0}>
                {isSubmitting ? 'Wysyłanie...' : 'Wygeneruj i wyślij'}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
