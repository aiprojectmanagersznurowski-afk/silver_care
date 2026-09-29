'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MailCheck } from 'lucide-react'
import type { UserItem } from '@/components/IamManagementClient'

interface ResetPasswordDialogProps {
  user: UserItem | null
  error: string | null
  isPending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ResetPasswordDialog({
  user,
  error,
  isPending,
  onSubmit,
  onClose,
}: ResetPasswordDialogProps) {
  return (
    <Dialog open={Boolean(user)} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resetuj hasło użytkownika</DialogTitle>
          <DialogDescription>
            Wyślij bezpieczny link resetujący na adres e-mail konta <strong>{user?.email}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 py-2">
          <div className="rounded-xl border border-slate/10 bg-slate/5 p-4 flex items-start gap-3 text-sm text-slate">
            <MailCheck className="h-5 w-5 text-sage shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-slate">Procedura bezpiecznego resetu hasła (IAM Hardening)</p>
              <p className="mt-1 text-xs text-slate-soft leading-relaxed">
                Zgodnie z zasadami bezpieczeństwa hasło nie jest ustalane ręcznie przez administratora. Po potwierdzeniu na adres <strong>{user?.email}</strong> zostanie wygenerowany i przesłany bezpieczny link do zresetowania hasła. Użytkownik samodzielnie zdefiniuje nowe hasło.
              </p>
            </div>
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isPending} className="bg-sage text-white hover:bg-sage/90">
              {isPending ? 'Wysyłanie linku...' : 'Wyślij link resetujący'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
