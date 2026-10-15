'use client'

import { useState, useTransition } from 'react'
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
} from '@/components/ui/dialog'
import { resendAdminInviteAction } from '@/actions/organizations'
import { Mail, Copy, Check, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export interface ResendAdminInviteButtonProps {
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
        className="rounded-xl border-border text-foreground hover:bg-muted/50 text-sm min-h-11 font-medium gap-1.5"
        title="Wyślij e-mail z zaproszeniem lub wygeneruj link aktywacyjny"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 text-primary" />}
        <span>{isPending ? 'Wysyłanie...' : 'Wyślij zaproszenie'}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-xl p-6">
          <DialogHeader>
            <DialogTitle>Zaproszenie administratora</DialogTitle>
            <DialogDescription>
              Status zaproszenia dla konta {adminEmail} w placówce „{organizationName}”.
            </DialogDescription>
          </DialogHeader>

          {resultData?.error ? (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{resultData.error}</span>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 text-sm text-foreground space-y-1">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>
                    {resultData?.emailSent
                      ? 'E-mail z zaproszeniem został wysłany!'
                      : 'Link aktywacyjny został pomyślnie wygenerowany.'
                    }
                  </span>
                </div>
                <p className="text-muted-foreground pl-6">
                  {resultData?.emailSent
                    ? `Wiadomość z bezpośrednim linkiem trafiła na adres ${adminEmail}.`
                    : 'Możesz skopiować poniższy bezpośredni link i przekazać go administratorowi.'
                  }
                </p>
              </div>

              {resultData?.inviteUrl && (
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-foreground">Bezpośredni link aktywacyjny:</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={resultData.inviteUrl}
                      className="font-mono text-sm bg-muted/50"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(resultData.inviteUrl!)}
                      className="shrink-0 gap-1 text-sm min-h-11"
                    >
                      {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
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
