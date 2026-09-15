'use client'

import React, { useState, useTransition } from 'react'
import { resetStaffPasswordAction, suspendStaffAction, restoreStaffAction } from '@/actions/staff-management'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KeyRound, Ban, CheckCircle, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface StaffActionsMenuProps {
  staffId: string
  email?: string
  isActive: boolean
}

export function StaffActionsMenu({ staffId, email, isActive }: StaffActionsMenuProps) {
  const [isPending, startTransition] = useTransition()
  const [dialogType, setDialogType] = useState<'none' | 'reset' | 'suspend' | 'restore'>('none')
  const [confirmationInput, setConfirmationInput] = useState('')
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleResetPassword = (mode: 'email' | 'temp') => {
    setStatusMsg(null)
    const formData = new FormData()
    formData.append('staffId', staffId)
    formData.append('mode', mode)

    startTransition(async () => {
      const res = await resetStaffPasswordAction(formData)
      if (res.error) {
        setStatusMsg({ type: 'error', text: res.error })
      } else {
        setStatusMsg({ type: 'success', text: res.message || 'Wykonano pomyślnie.' })
      }
    })
  }

  const handleSuspend = () => {
    setStatusMsg(null)
    const formData = new FormData()
    formData.append('staffId', staffId)
    formData.append('confirmation', confirmationInput)

    startTransition(async () => {
      const res = await suspendStaffAction(formData)
      if (res.error) {
        setStatusMsg({ type: 'error', text: res.error })
      } else {
        setStatusMsg({ type: 'success', text: res.message || 'Konto zawieszone.' })
        setDialogType('none')
        setConfirmationInput('')
      }
    })
  }

  const handleRestore = () => {
    setStatusMsg(null)
    const formData = new FormData()
    formData.append('staffId', staffId)

    startTransition(async () => {
      const res = await restoreStaffAction(formData)
      if (res.error) {
        setStatusMsg({ type: 'error', text: res.error })
      } else {
        setStatusMsg({ type: 'success', text: res.message || 'Konto przywrócone.' })
        setDialogType('none')
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors">
          <span className="sr-only">Otwórz menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Zarządzaj kontem</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setDialogType('reset')}>
            <KeyRound className="mr-2 h-4 w-4 text-amber-600" />
            Zresetuj hasło
          </DropdownMenuItem>

          {isActive ? (
            <DropdownMenuItem onClick={() => setDialogType('suspend')} className="text-red-600 focus:text-red-600">
              <Ban className="mr-2 h-4 w-4" />
              Zawieś konto
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setDialogType('restore')} className="text-emerald-600 focus:text-emerald-600">
              <CheckCircle className="mr-2 h-4 w-4" />
              Przywróć konto
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Modal Resetu Hasła */}
      <Dialog open={dialogType === 'reset'} onOpenChange={(open) => !open && setDialogType('none')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Hasła Pracownika</DialogTitle>
            <DialogDescription>
              Wybierz metodę resetu hasła dla konta <span className="font-semibold text-slate-800">{email}</span>.
            </DialogDescription>
          </DialogHeader>

          {statusMsg && (
            <div className={`p-3 text-sm rounded-md ${statusMsg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {statusMsg.text}
            </div>
          )}

          <div className="space-y-3 py-2">
            <Button
              className="w-full justify-start"
              variant="outline"
              disabled={isPending}
              onClick={() => handleResetPassword('email')}
            >
              Wyślij e-mail z linkiem do resetu hasła
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              disabled={isPending}
              onClick={() => handleResetPassword('temp')}
            >
              Wygeneruj bezpieczne hasło tymczasowe
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogType('none')}>
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Zawieszenia Konta (Wpisanie DEZAKTYWUJ) */}
      <Dialog open={dialogType === 'suspend'} onOpenChange={(open) => !open && setDialogType('none')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zawieszenie Konta Pracownika</DialogTitle>
            <DialogDescription>
              Operacja natychmiast zablokuje możliwość logowania pracownika <span className="font-semibold text-slate-800">{email}</span> i unieważni wszystkie aktywne sesje.
            </DialogDescription>
          </DialogHeader>

          {statusMsg && (
            <div className="p-3 text-sm rounded-md bg-red-50 text-red-700">
              {statusMsg.text}
            </div>
          )}

          <div className="space-y-3 py-2">
            <Label htmlFor="confirmation">
              Aby potwierdzić, wpisz słowo <span className="font-bold text-red-600">DEZAKTYWUJ</span>:
            </Label>
            <Input
              id="confirmation"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder="DEZAKTYWUJ"
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogType('none')} disabled={isPending}>
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={isPending || confirmationInput !== 'DEZAKTYWUJ'}
            >
              {isPending ? 'Zawieszanie...' : 'Zawieś konto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Przywrócenia Konta */}
      <Dialog open={dialogType === 'restore'} onOpenChange={(open) => !open && setDialogType('none')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Przywrócenie Konta Pracownika</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz przywrócić dostęp do konta dla pracownika <span className="font-semibold text-slate-800">{email}</span>?
            </DialogDescription>
          </DialogHeader>

          {statusMsg && (
            <div className={`p-3 text-sm rounded-md ${statusMsg.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {statusMsg.text}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogType('none')} disabled={isPending}>
              Anuluj
            </Button>
            <Button
              onClick={handleRestore}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isPending ? 'Przywracanie...' : 'Przywróć konto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
