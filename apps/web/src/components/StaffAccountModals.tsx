'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type StaffDialogType = 'none' | 'reset' | 'suspend' | 'restore'

interface StaffAccountModalsProps {
  dialogType: StaffDialogType
  onClose: () => void
  email?: string
  statusMsg: { type: 'success' | 'error'; text: string } | null
  isPending: boolean
  confirmationInput: string
  onConfirmationInputChange: (val: string) => void
  onResetPassword: (mode: 'email' | 'temp') => void
  onSuspend: () => void
  onRestore: () => void
}

export function StaffAccountModals({
  dialogType,
  onClose,
  email,
  statusMsg,
  isPending,
  confirmationInput,
  onConfirmationInputChange,
  onResetPassword,
  onSuspend,
  onRestore,
}: StaffAccountModalsProps) {
  return (
    <>
      {/* Modal Resetu Hasła */}
      <Dialog open={dialogType === 'reset'} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg md:max-w-xl p-6">
          <DialogHeader>
            <DialogTitle>Reset Hasła Pracownika</DialogTitle>
            <DialogDescription>
              Wybierz metodę resetu hasła dla konta <span className="font-semibold text-foreground">{email}</span>.
            </DialogDescription>
          </DialogHeader>

          {statusMsg && (
            <div className={`p-3 text-sm rounded-md ${statusMsg.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'}`}>
              {statusMsg.text}
            </div>
          )}

          <div className="space-y-3 py-2">
            <Button
              className="w-full justify-start min-h-11"
              variant="outline"
              disabled={isPending}
              onClick={() => onResetPassword('email')}
            >
              Wyślij e-mail z linkiem do resetu hasła
            </Button>
            <Button
              className="w-full justify-start min-h-11"
              variant="outline"
              disabled={isPending}
              onClick={() => onResetPassword('temp')}
            >
              Wygeneruj bezpieczne hasło tymczasowe
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} className="min-h-11">
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Zawieszenia Konta (Wpisanie DEZAKTYWUJ) */}
      <Dialog open={dialogType === 'suspend'} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg md:max-w-xl p-6">
          <DialogHeader>
            <DialogTitle>Zawieszenie Konta Pracownika</DialogTitle>
            <DialogDescription>
              Operacja natychmiast zablokuje możliwość logowania pracownika <span className="font-semibold text-foreground">{email}</span> i unieważni wszystkie aktywne sesje.
            </DialogDescription>
          </DialogHeader>

          {statusMsg && (
            <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive">
              {statusMsg.text}
            </div>
          )}

          <div className="space-y-3 py-2">
            <Label htmlFor="confirmation">
              Aby potwierdzić, wpisz słowo <span className="font-bold text-foreground">DEZAKTYWUJ</span>:
            </Label>
            <Input
              id="confirmation"
              value={confirmationInput}
              onChange={(e) => onConfirmationInputChange(e.target.value)}
              placeholder="DEZAKTYWUJ"
              disabled={isPending}
              className="min-h-11"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={isPending} className="min-h-11">
              Anuluj
            </Button>
            <Button
              variant="default"
              onClick={onSuspend}
              disabled={isPending || confirmationInput !== 'DEZAKTYWUJ'}
              className="min-h-11"
            >
              {isPending ? 'Zawieszanie...' : 'Zawieś konto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Przywrócenia Konta */}
      <Dialog open={dialogType === 'restore'} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg md:max-w-xl p-6">
          <DialogHeader>
            <DialogTitle>Przywrócenie Konta Pracownika</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz przywrócić dostęp do konta dla pracownika <span className="font-semibold text-foreground">{email}</span>?
            </DialogDescription>
          </DialogHeader>

          {statusMsg && (
            <div className={`p-3 text-sm rounded-md ${statusMsg.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'}`}>
              {statusMsg.text}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={isPending} className="min-h-11">
              Anuluj
            </Button>
            <Button
              onClick={onRestore}
              disabled={isPending}
              className="bg-primary hover:bg-primary text-white min-h-11"
            >
              {isPending ? 'Przywracanie...' : 'Przywróć konto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
