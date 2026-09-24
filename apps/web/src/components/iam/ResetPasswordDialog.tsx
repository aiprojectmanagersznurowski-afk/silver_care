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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UserItem } from '@/components/IamManagementClient'

interface ResetPasswordDialogProps {
  user: UserItem | null
  customPassword: string
  onCustomPasswordChange: (value: string) => void
  error: string | null
  isPending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ResetPasswordDialog({
  user,
  customPassword,
  onCustomPasswordChange,
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
            Ustaw nowe hasło dla konta <strong>{user?.email}</strong> lub wygeneruj hasło losowe.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="reset-new-password">Nowe hasło (opcjonalne)</Label>
            <Input
              id="reset-new-password"
              type="text"
              placeholder="Zostaw puste, aby wygenerować automatycznie"
              value={customPassword}
              onChange={e => onCustomPasswordChange(e.target.value)}
            />
            <p className="text-[0.75rem] text-slate-soft">
              Wpisz hasło (minimum 6 znaków) lub pozostaw to pole puste, aby system wygenerował bezpieczne hasło losowe.
            </p>
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isPending} className="bg-sage text-white hover:bg-sage/90">
              {isPending ? 'Zapisywanie...' : 'Zapisz nowe hasło'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
