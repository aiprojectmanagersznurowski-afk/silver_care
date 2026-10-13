'use client'

import { useState, useEffect } from 'react'
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
import { ShieldBan, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react'
import type { UserItem } from '@/components/IamManagementClient'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { cn } from '@/lib/utils'

interface DeleteUserDialogProps {
  user: UserItem | null
  isPending: boolean
  error: string | null
  onSubmit: (userId: string, mode: 'deactivate' | 'activate' | 'hard_delete') => Promise<void>
  onClose: () => void
}

export function DeleteUserDialog({
  user,
  isPending,
  error,
  onSubmit,
  onClose,
}: DeleteUserDialogProps) {
  const [mode, setMode] = useState<'deactivate' | 'hard_delete' | 'activate'>('deactivate')
  const [confirmText, setConfirmText] = useState('')

  useEffect(() => {
    if (user) {
      setMode(user.isActive === false ? 'activate' : 'deactivate')
      setConfirmText('')
    }
  }, [user])

  if (!user) return null

  const isDeactivated = user.isActive === false
  const isConfirmValid = mode !== 'hard_delete' || confirmText.trim().toUpperCase() === 'USUŃ'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConfirmValid || isPending) return
    await onSubmit(user.id, mode)
  }

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl shrink-0',
              mode === 'hard_delete' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
            )}>
              {mode === 'hard_delete' ? (
                <Trash2 className="h-5 w-5" />
              ) : mode === 'activate' ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <ShieldBan className="h-5 w-5" />
              )}
            </div>
            <div>
              <DialogTitle>Zarządzaj statusem konta</DialogTitle>
              <DialogDescription>
                Decyzja o dostępie i tożsamości użytkownika <strong>{user.email}</strong>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border text-xs">
            <span className="text-muted-foreground">Identyfikator użytkownika:</span>
            <BusinessIdBadge type="user" id={user.id} />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Wybierz operację:</Label>
            <div className="grid grid-cols-1 gap-2.5">
              {/* Opcja 1: Deaktywacja / Blokada */}
              {!isDeactivated ? (
                <div
                  onClick={() => setMode('deactivate')}
                  className={cn(
                    'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors',
                    mode === 'deactivate'
                      ? 'border-primary/50 bg-primary/10 text-foreground ring-1 ring-primary/30'
                      : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                  )}
                >
                  <ShieldBan className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                      <span>Zablokuj konto</span>
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                        Zalecane
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      Natychmiast unieważnia aktywne sesje i blokuje możliwość logowania. Zachowuje całą historię raportów, wpisów i audytu. Konto można w każdej chwili odblokować.
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setMode('activate')}
                  className={cn(
                    'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors',
                    mode === 'activate'
                      ? 'border-primary/50 bg-primary/10 text-foreground ring-1 ring-primary/30'
                      : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                  )}
                >
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold text-foreground text-sm">Odblokuj konto</div>
                    <p className="text-muted-foreground leading-relaxed">
                      Zdejmuje blokadę dostępu i przywraca użytkownikowi możliwość logowania do systemu.
                    </p>
                  </div>
                </div>
              )}

              {/* Opcja 2: Trwałe usunięcie */}
              <div
                onClick={() => setMode('hard_delete')}
                className={cn(
                  'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors',
                  mode === 'hard_delete'
                    ? 'border-destructive/50 bg-destructive/10 text-foreground ring-1 ring-destructive/30'
                    : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'
                )}
              >
                <Trash2 className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                    <span>Usuń trwale</span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">
                      Nieodwracalne
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Fizycznie usuwa rekord użytkownika z bazy danych tożsamości. Używaj wyłącznie dla kont testowych lub omyłkowo założonych.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Ostrzeżenie i pole potwierdzenia dla hard delete */}
          {mode === 'hard_delete' && (
            <div className="space-y-2 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-2 text-xs font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Wymagane dodatkowe potwierdzenie</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Aby trwale usunąć to konto, wpisz poniżej słowo <strong className="text-destructive font-mono">USUŃ</strong>:
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Wpisz USUŃ"
                className="bg-background text-sm font-mono uppercase"
                autoComplete="off"
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-destructive bg-destructive/10 rounded-xl border border-destructive/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
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
              variant={mode === 'hard_delete' ? 'destructive' : mode === 'activate' ? 'default' : 'outline'}
              className={cn(
                mode === 'deactivate' && 'border-border text-foreground hover:bg-muted'
              )}
              disabled={!isConfirmValid || isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {mode === 'hard_delete'
                ? 'Usuń konto trwale'
                : mode === 'activate'
                ? 'Odblokuj konto'
                : 'Zablokuj konto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
