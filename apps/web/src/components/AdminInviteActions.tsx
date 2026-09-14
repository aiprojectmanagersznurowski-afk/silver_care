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
import { resendAdminInviteAction, addAdminToOrganizationAction } from '@/actions/organizations'
import { Mail, Copy, Check, UserPlus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

interface ResendAdminInviteButtonProps {
  adminEmail: string
  organizationId: string
  organizationName: string
}

export function ResendAdminInviteButton({
  adminEmail,
  organizationId,
  organizationName
}: ResendAdminInviteButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [resultData, setResultData] = useState<{ inviteUrl?: string | null; emailSent?: boolean; error?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleResend = () => {
    setResultData(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('adminEmail', adminEmail)
      formData.set('organizationId', organizationId)
      formData.set('orgName', organizationName)

      const res = await resendAdminInviteAction(formData)
      if (res?.error) {
        setResultData({ error: res.error })
      } else {
        setResultData({
          inviteUrl: res.inviteUrl,
          emailSent: res.emailSent
        })
      }
      setOpen(true)
    })
  }

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={handleResend}
        className="rounded-xl border-slate/20 text-slate hover:bg-slate/5 text-xs h-9 font-medium gap-1.5"
        title="Wyślij e-mail z zaproszeniem lub wygeneruj link aktywacyjny"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5 text-sage" />}
        <span>{isPending ? 'Wysyłanie...' : 'Wyślij zaproszenie'}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Zaproszenie administratora</DialogTitle>
            <DialogDescription>
              Status zaproszenia dla konta {adminEmail} w placówce „{organizationName}”.
            </DialogDescription>
          </DialogHeader>

          {resultData?.error ? (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{resultData.error}</span>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-sage/10 border border-sage/20 p-4 text-xs text-slate space-y-1">
                <div className="flex items-center gap-2 font-semibold text-slate">
                  <CheckCircle2 className="h-4 w-4 text-sage" />
                  <span>
                    {resultData?.emailSent
                      ? 'E-mail z zaproszeniem został wysłany!'
                      : 'Link aktywacyjny został pomyślnie wygenerowany.'
                    }
                  </span>
                </div>
                <p className="text-slate-soft pl-6">
                  {resultData?.emailSent
                    ? `Wiadomość z bezpośrednim linkiem trafiła na adres ${adminEmail}.`
                    : 'Możesz skopiować poniższy bezpośredni link i przekazać go administratorowi.'
                  }
                </p>
              </div>

              {resultData?.inviteUrl && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-soft">Bezpośredni link aktywacyjny:</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={resultData.inviteUrl}
                      className="font-mono text-xs bg-slate/5"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(resultData.inviteUrl!)}
                      className="shrink-0 gap-1 text-xs"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-sage" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Skopiowano' : 'Kopiuj'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface AddAdminToOrgDialogProps {
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj administratora placówki</DialogTitle>
          <DialogDescription>
            Nadaj uprawnienia org_admin dla ośrodka „{organizationName}” i wyślij zaproszenie.
          </DialogDescription>
        </DialogHeader>

        {successData ? (
          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-sage/10 border border-sage/20 p-4 text-xs text-slate space-y-1">
              <div className="flex items-center gap-2 font-semibold text-slate">
                <CheckCircle2 className="h-4 w-4 text-sage" />
                <span>
                  {successData.emailSent
                    ? 'Zaproszenie zostało pomyślnie wysłane!'
                    : 'Administrator został przypisany do placówki.'
                  }
                </span>
              </div>
              <p className="text-slate-soft pl-6">
                {successData.emailSent
                  ? 'Wiadomość z linkiem aktywacyjnym została przesłana na podany adres e-mail.'
                  : 'Możesz przekazać poniższy link aktywacyjny bezpośrednio użytkownikowi.'
                }
              </p>
            </div>

            {successData.inviteUrl && (
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-soft">Link aktywacyjny:</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={successData.inviteUrl}
                    className="font-mono text-xs bg-slate/5"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(successData.inviteUrl!)}
                    className="shrink-0 gap-1 text-xs"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-sage" /> : <Copy className="h-3.5 w-3.5" />}
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
              <Label htmlFor="newAdminEmail" className="text-xs font-semibold text-slate">
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
                className="rounded-xl border-slate/15 focus:border-sage"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newAdminFullName" className="text-xs font-semibold text-slate">
                Imię i nazwisko (opcjonalnie)
              </Label>
              <Input
                id="newAdminFullName"
                placeholder="np. Anna Nowak"
                value={adminFullName}
                onChange={(e) => setAdminFullName(e.target.value)}
                disabled={isPending}
                className="rounded-xl border-slate/15 focus:border-sage"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center gap-2">
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
                className="bg-slate text-white hover:bg-slate/90"
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
