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
import { ShieldAlert } from 'lucide-react'
import type { UserItem } from '@/components/IamManagementClient'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

interface ChangeRoleDialogProps {
  user: UserItem | null
  selectedRole: string
  onRoleChange: (newRole: string) => void
  availableRoles: { id: string; label: string }[]
  roleLabels: Record<string, string>
  isPending: boolean
  error: string | null
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function ChangeRoleDialog({
  user,
  selectedRole,
  onRoleChange,
  availableRoles,
  roleLabels,
  isPending,
  error,
  onSubmit,
  onClose,
}: ChangeRoleDialogProps) {
  if (!user) return null

  const currentRoleLabel = roleLabels[user.role] || user.role
  const newRoleLabel = roleLabels[selectedRole] || selectedRole
  const hasChanged = selectedRole !== user.role

  return (
    <Dialog open={Boolean(user)} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zmień uprawnienia użytkownika</DialogTitle>
          <DialogDescription>
            Zarządzaj przypisaną rolą dla konta <strong>{user.email}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <label htmlFor="change-role-select" className="text-sm font-medium text-foreground">
              Wybierz nową rolę
            </label>
            <NativeSelect
              id="change-role-select"
              aria-label={`Wybierz nową rolę dla ${user.email}`}
              value={selectedRole}
              onChange={e => onRoleChange(e.target.value)}
              disabled={isPending}
            >
              {availableRoles.map(r => (
                <NativeSelectOption key={r.id} value={r.id}>
                  {r.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="rounded-xl border border-border bg-muted/50 p-4 flex items-start gap-3 text-sm text-foreground">
            <ShieldAlert className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Potwierdzenie zmiany uprawnień</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Czy na pewno chcesz zmienić uprawnienia użytkownika <strong>{user.email}</strong> z <strong>{currentRoleLabel}</strong> na <strong>{newRoleLabel}</strong>?
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
            <Button
              type="submit"
              disabled={!hasChanged || isPending}
              className="bg-primary text-white hover:bg-primary/90 disabled:opacity-40"
            >
              {isPending ? 'Zapisywanie...' : 'Potwierdź'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
