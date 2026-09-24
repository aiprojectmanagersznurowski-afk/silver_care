'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus } from 'lucide-react'

interface AddUserDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  newEmail: string
  onEmailChange: (value: string) => void
  newRole: string
  onRoleChange: (value: string) => void
  newPassword: string
  onPasswordChange: (value: string) => void
  newOrgId: string
  onOrgIdChange: (value: string) => void
  availableRoles: { id: string; label: string }[]
  error: string | null
  isPending: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function AddUserDialog({
  isOpen,
  onOpenChange,
  newEmail,
  onEmailChange,
  newRole,
  onRoleChange,
  newPassword,
  onPasswordChange,
  newOrgId,
  onOrgIdChange,
  availableRoles,
  error,
  isPending,
  onSubmit,
}: AddUserDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <UserPlus className="h-4 w-4 mr-2" />
        Dodaj użytkownika
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Utwórz użytkownika i nadaj rolę</DialogTitle>
          <DialogDescription>
            Załóż nowe konto w systemie i natychmiast przypisz uprawnienia platformowe.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="new-user-email">Adres e-mail *</Label>
            <Input
              id="new-user-email"
              type="email"
              placeholder="np. jan.kowalski@placowka.pl"
              value={newEmail}
              onChange={e => onEmailChange(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-user-role">Rola systemowa *</Label>
            <select
              id="new-user-role"
              value={newRole}
              onChange={e => onRoleChange(e.target.value)}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {availableRoles.map(r => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-user-password">Hasło początkowe (opcjonalne)</Label>
            <Input
              id="new-user-password"
              type="text"
              placeholder="Zostaw puste, aby wygenerować automatycznie"
              value={newPassword}
              onChange={e => onPasswordChange(e.target.value)}
            />
            <p className="text-[0.75rem] text-slate-soft">
              Jeśli nie podasz hasła, system wygeneruje bezpieczny ciąg znaków i wyświetli go po utworzeniu.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-user-org">ID Placówki / Organizacji (opcjonalne)</Label>
            <Input
              id="new-user-org"
              type="text"
              placeholder="UUID placówki (pozostaw puste dla ról globalnych)"
              value={newOrgId}
              onChange={e => onOrgIdChange(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isPending} className="bg-sage text-white hover:bg-sage/90">
              {isPending ? 'Tworzenie...' : 'Utwórz i nadaj rolę'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
