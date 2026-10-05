'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
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

export function InviteStaffDialog() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('nurse')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('E-mail jest wymagany.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    let avatar_url = null
    if (avatarFile) {
      try {
        const { optimizeImageForUpload } = await import('@/lib/image-optimizer')
        const { file: optimizedAvatar } = await optimizeImageForUpload(avatarFile, {
          maxWidth: 400,
          maxHeight: 400,
          quality: 0.85,
          prefix: 'staff_av'
        })
        const supabase = createClient()
        const filePath = `staff/${optimizedAvatar.name}`
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, optimizedAvatar)
          
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
      const res = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role, avatar_url }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setGeneratedUrl(data.url)
        setEmail('')
        setRole('nurse')
        setAvatarFile(null)
        // setOpen(false)
        // window.location.reload()
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
        Zaproś pracownika
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zaproś pracownika do placówki</DialogTitle>
          <DialogDescription>
            Wyślij e-mail z zaproszeniem. Użytkownik zostanie automatycznie przypisany do Twojej organizacji.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adres e-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="np. jan.kowalski@szpital.pl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Rola</Label>
            <NativeSelect
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)} className="flex w-full items-center justify-between disabled:cursor-not-allowed disabled:opacity-50"
            >
              <NativeSelectOption value="nurse">Pielęgniarka / Pielęgniarz</NativeSelectOption>
              <NativeSelectOption value="paramedic">Sanitariusz / Sanitariuszka</NativeSelectOption>
              <NativeSelectOption value="org_admin">Administrator Placówki (org_admin)</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatar">Zdjęcie profilowe (opcjonalnie)</Label>
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
          {generatedUrl && (
            <div className="mt-4 p-4 border border-border bg-primary rounded-md space-y-2">
              <p className="text-sm font-semibold text-foreground dark:text-foreground">
                Zaproszenie wygenerowane pomyślnie!
              </p>
              <p className="text-xs text-muted-foreground">
                Wyślij poniższy link pracownikowi, aby umożliwić założenie konta:
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Wysyłanie...' : 'Wyślij zaproszenie'}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
