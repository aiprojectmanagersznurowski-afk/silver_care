'use client'

import { Key, ShieldAlert, Trash2, ShieldBan } from 'lucide-react'
import { RowActions } from '@/components/patterns/RowActions'
import type { UserItem } from '@/components/IamManagementClient'

interface UserRowActionsProps {
  user: UserItem
  isSelf: boolean
  isDeactivated: boolean
  onChangeRoleClick: (user: UserItem) => void
  onResetPasswordClick: (user: UserItem) => void
  onDeleteUserClick: (user: UserItem) => void
}

/** Akcje konta w IAM w menu „⋯" — te same w tabeli i w kafelku. */
export function UserRowActions({ user, isSelf, isDeactivated, onChangeRoleClick, onResetPasswordClick, onDeleteUserClick }: UserRowActionsProps) {
  return (
    <RowActions
      label="Zarządzaj kontem"
      actions={[
        { label: 'Zmień rolę', icon: ShieldAlert, hint: 'Zmień uprawnienia i przypisaną rolę', onSelect: () => onChangeRoleClick(user) },
        { label: 'Hasło', icon: Key, hint: 'Resetuj hasło lub wyślij link e-mail', onSelect: () => onResetPasswordClick(user) },
        {
          label: isDeactivated ? 'Status' : 'Usuń',
          icon: isDeactivated ? ShieldBan : Trash2,
          separated: true,
          disabled: isSelf,
          hint: isSelf
            ? 'Nie możesz zablokować ani usunąć własnego konta'
            : isDeactivated ? 'Zarządzaj statusem (odblokuj lub usuń trwale)' : 'Zablokuj konto lub usuń trwale',
          onSelect: () => onDeleteUserClick(user),
        },
      ]}
    />
  )
}
