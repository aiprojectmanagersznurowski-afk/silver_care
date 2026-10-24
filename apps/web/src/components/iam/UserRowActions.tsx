'use client'

import { Button } from '@/components/ui/button'
import { Key, ShieldAlert, Trash2, ShieldBan } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { UserItem } from '@/components/IamManagementClient'
import { cn } from '@/lib/utils'

interface UserRowActionsProps {
  user: UserItem
  isSelf: boolean
  isDeactivated: boolean
  onChangeRoleClick: (user: UserItem) => void
  onResetPasswordClick: (user: UserItem) => void
  onDeleteUserClick: (user: UserItem) => void
}

/** Akcje konta w IAM — te same w tabeli i w kafelku. */
export function UserRowActions({ user, isSelf, isDeactivated, onChangeRoleClick, onResetPasswordClick, onDeleteUserClick }: UserRowActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChangeRoleClick(user)}
              className="min-h-touch rounded-xl border-border text-foreground hover:bg-muted/50"
            >
              <ShieldAlert className="h-4 w-4 mr-1.5 text-muted-foreground" />
              Zmień rolę
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Zmień uprawnienia i przypisaną rolę
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onResetPasswordClick(user)}
              className="min-h-touch rounded-xl border-border text-foreground hover:bg-muted/50"
            >
              <Key className="h-4 w-4 mr-1.5 text-muted-foreground" />
              Hasło
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Resetuj hasło lub wyślij link e-mail
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSelf}
              onClick={() => onDeleteUserClick(user)}
              className={cn(
                'min-h-touch rounded-xl border-border',
                isSelf
                  ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                  : isDeactivated
                  ? 'text-primary hover:bg-primary/10 border-primary/30'
                  : 'text-foreground hover:bg-muted border-border'
              )}
            >
              {isDeactivated ? (
                <ShieldBan className="h-4 w-4 mr-1.5" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              {isDeactivated ? 'Status' : 'Usuń'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isSelf
              ? 'Nie możesz zablokować ani usunąć własnego konta'
              : isDeactivated
              ? 'Zarządzaj statusem (odblokuj lub usuń trwale)'
              : 'Zablokuj konto lub usuń trwale'}
          </TooltipContent>
        </Tooltip>
      </div>
  )
}
