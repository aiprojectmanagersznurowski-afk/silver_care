'use client'

import React, { useState, useTransition } from 'react'
import { resetStaffPasswordAction, suspendStaffAction, restoreStaffAction } from '@/actions/staff-management'
import { KeyRound, Ban, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { RowActionsTrigger } from '@/components/patterns/RowActions'
import { StaffAccountModals, StaffDialogType } from './StaffAccountModals'

interface StaffActionsMenuProps {
  staffId: string
  email?: string
  isActive: boolean
}

export function StaffActionsMenu({ staffId, email, isActive }: StaffActionsMenuProps) {
  const [isPending, startTransition] = useTransition()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dialogType, setDialogType] = useState<StaffDialogType>('none')
  const [confirmationInput, setConfirmationInput] = useState('')
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const openDialog = (type: StaffDialogType) => {
    setDropdownOpen(false)
    setStatusMsg(null)
    setConfirmationInput('')
    setDialogType(type)
  }

  const handleResetPassword = (mode: 'email' | 'temp') => {
    setStatusMsg(null)
    const formData = new FormData()
    formData.append('staffId', staffId)
    formData.append('mode', mode)

    startTransition(async () => {
      try {
        const res = await resetStaffPasswordAction(formData)
        if (res?.error) {
          setStatusMsg({ type: 'error', text: res.error })
          toast.error(res.error)
        } else {
          const msg = res?.message || 'Wykonano pomyślnie.'
          setStatusMsg({ type: 'success', text: msg })
          toast.success(msg)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd podczas resetu hasła.'
        setStatusMsg({ type: 'error', text: msg })
        toast.error(msg)
      }
    })
  }

  const handleSuspend = () => {
    setStatusMsg(null)
    const formData = new FormData()
    formData.append('staffId', staffId)
    formData.append('confirmation', confirmationInput)

    startTransition(async () => {
      try {
        const res = await suspendStaffAction(formData)
        if (res?.error) {
          setStatusMsg({ type: 'error', text: res.error })
          toast.error(res.error)
        } else {
          const msg = res?.message || 'Konto pracownika zostało zawieszone.'
          toast.success(msg)
          setDialogType('none')
          setConfirmationInput('')
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd podczas zawieszania konta.'
        setStatusMsg({ type: 'error', text: msg })
        toast.error(msg)
      }
    })
  }

  const handleRestore = () => {
    setStatusMsg(null)
    const formData = new FormData()
    formData.append('staffId', staffId)

    startTransition(async () => {
      try {
        const res = await restoreStaffAction(formData)
        if (res?.error) {
          setStatusMsg({ type: 'error', text: res.error })
          toast.error(res.error)
        } else {
          const msg = res?.message || 'Konto pracownika zostało przywrócone.'
          toast.success(msg)
          setDialogType('none')
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd podczas przywracania konta.'
        setStatusMsg({ type: 'error', text: msg })
        toast.error(msg)
      }
    })
  }

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <RowActionsTrigger />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Zarządzaj kontem</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => openDialog('reset')} className="min-h-touch cursor-pointer">
            <KeyRound className="mr-2 h-4 w-4 text-foreground" />
            Zresetuj hasło
          </DropdownMenuItem>

          {isActive ? (
            <DropdownMenuItem onClick={() => openDialog('suspend')} className="min-h-touch cursor-pointer">
              <Ban className="mr-2 h-4 w-4" />
              Zawieś konto
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => openDialog('restore')} className="text-foreground focus:text-foreground min-h-touch cursor-pointer">
              <CheckCircle className="mr-2 h-4 w-4" />
              Przywróć konto
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <StaffAccountModals
        dialogType={dialogType}
        onClose={() => setDialogType('none')}
        email={email}
        statusMsg={statusMsg}
        isPending={isPending}
        confirmationInput={confirmationInput}
        onConfirmationInputChange={setConfirmationInput}
        onResetPassword={handleResetPassword}
        onSuspend={handleSuspend}
        onRestore={handleRestore}
      />
    </>
  )
}
