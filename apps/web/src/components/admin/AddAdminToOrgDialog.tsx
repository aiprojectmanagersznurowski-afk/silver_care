'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import { addAdminToOrganizationAction } from '@/actions/organizations'
import { Copy, Check, UserPlus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export interface AddAdminToOrgDialogProps {
  organizationId: string
  organizationName: string
}

export function AddAdminToOrgDialog({
  organizationId,
  organizationName
}: AddAdminToOrgDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [adminEmail, setAdminEmail] = useState('')
  const [adminFullName, setAdminFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{ inviteUrl?: string | null; emailSent?: boolean } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessData(null)

    if (!adminEmail.trim()) {
      setError('Adres e-mail jest wymagany.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('organizationId', organizationId)
      formData.set('orgName', organizationName)
      formData.set('adminEmail', adminEmail.trim())
      formData.set('adminFullName', adminFullName.trim())

      const res = await addAdminToOrganizationAction(formData)

      if (res?.error) {
        setError(res.error)
      } else {
        setSuccessData({
          inviteUrl: res.inviteUrl,
          emailSent: res.emailSent
        })
        setAdminEmail('')
        setAdminFullName('')
        router.refresh()
      }
    })
  }

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v)
      if (!v) {
        setError(null)
        setSuccessData(null)
      }
    }}>
      <DialogTrigger render={<Button />}>
        <UserPlus className="h-4 w-4 mr-2" />
        Dodaj administratora
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl md:max-w-2xl p-6">
        <DialogHeader>
          <DialogTitle>Dodaj kierownika placówki</DialogTitle>
          <DialogDescription>
            Nadaj uprawnienia org_admin dla placówki „{organizationName}” i wyślij zaproszenie.
          </DialogDescription>
        </DialogHeader>

        {successData ? (
          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 text-sm text-foreground space-y-1">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>
                  {successData.emailSent
                    ? 'Zaproszenie zostało pomyślnie wysłane!'
                    : 'Administrator został przypisany do placówki.'
                  }
                </span>
              </div>
              <p className="text-muted-foreground pl-6">
                {successData.emailSent
                  ? 'Wiadomość z linkiem aktywacyjnym została przesłana na podany adres e-mail.'
                  : 'Możesz przekazać poniższy link aktywacyjny bezpośrednio użytkownikowi.'
                }
              </p>
            </div>

            {successData.inviteUrl && (
              <div className="space-y-1.5">
                <Label className="text-sm text-muted-foreground">Link aktywacyjny:</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={successData.inviteUrl}
                    className="font-mono text-sm bg-muted/50"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(successData.inviteUrl!)}
                    className="shrink-0 gap-1 text-sm min-h-touch"
                  >
                    {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Skopiowano' : 'Kopiuj'}
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Gotowe
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="newAdminEmail" className="text-sm font-semibold text-foreground">
                Adres e-mail <span className="text-destructive">*</span>
              </Label>
              <Input
                id="newAdminEmail"
                type="email"
                required
                placeholder="np. dyrektor@placowka.pl"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                disabled={isPending}
                className="rounded-xl border-border focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newAdminFullName" className="text-sm font-semibold text-foreground">
                Imię i nazwisko (opcjonalnie)
              </Label>
              <Input
                id="newAdminFullName"
                placeholder="np. Anna Nowak"
                value={adminFullName}
                onChange={(e) => setAdminFullName(e.target.value)}
                disabled={isPending}
                className="rounded-xl border-border focus:border-primary"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-foreground text-white hover:bg-muted"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Zapisywanie...
                  </>
                ) : (
                  'Dodaj i wyślij zaproszenie'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
