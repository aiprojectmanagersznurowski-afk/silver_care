'use client'

import { Shield, ShieldBan } from 'lucide-react'
import type { UserItem } from '@/components/IamManagementClient'
import { AddUserDialog } from './AddUserDialog'
import type { ComponentProps } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { TableCard } from '@/components/patterns/TableCard'
import { ViewToggle, GRID_TABLE_OPTIONS } from '@/components/patterns/ViewToggle'
import { ObjectCard, ObjectGrid } from '@/components/patterns/ObjectCard'
import { useViewPreference, VIEW_PREFERENCE_KEYS } from '@/hooks/use-view-preference'
import { UserRowActions } from './UserRowActions'

interface UserTableProps {
  users: UserItem[]
  onChangeRoleClick: (user: UserItem) => void
  onResetPasswordClick: (user: UserItem) => void
  onDeleteUserClick: (user: UserItem) => void
  currentUserId?: string
  roleLabels: Record<string, string>
  addUserProps: ComponentProps<typeof AddUserDialog>
}

export function UserTable({
  users,
  onChangeRoleClick,
  onResetPasswordClick,
  onDeleteUserClick,
  currentUserId,
  roleLabels,
  addUserProps,
}: UserTableProps) {
  const [viewMode, setViewMode] = useViewPreference(VIEW_PREFERENCE_KEYS.iamUsers, 'table', ['table', 'grid'] as const)
  const badgesFor = (user: UserItem) => (
    <>
      <StatusBadge>{roleLabels[user.role] || user.role}</StatusBadge>
      {user.isActive === false && (
        <StatusBadge>
          <ShieldBan />
          Zablokowany
        </StatusBadge>
      )}
    </>
  )
  const actionsFor = (user: UserItem, wrap = false) => (
    <UserRowActions
      wrap={wrap}
      user={user}
      isSelf={user.id === currentUserId}
      isDeactivated={user.isActive === false}
      onChangeRoleClick={onChangeRoleClick}
      onResetPasswordClick={onResetPasswordClick}
      onDeleteUserClick={onDeleteUserClick}
    />
  )

  return (
    <TableCard
      icon={<Shield />}
      title="Użytkownicy i Role"
      description="Zarządzaj kontami użytkowników, przydziałem ról i uprawnień dostępowych."
      actions={
        <>
          <ViewToggle value={viewMode} onChange={setViewMode} options={GRID_TABLE_OPTIONS} />
          <AddUserDialog {...addUserProps} />
        </>
      }
    >
      {viewMode === 'grid' ? (
        <div className="p-4">
          <ObjectGrid>
            {users.map((user) => (
              <ObjectCard
                key={user.id}
                title={user.email}
                badges={badgesFor(user)}
                meta={[
                  { label: 'Identyfikator', value: <BusinessIdBadge type="user" id={user.id} /> },
                  { label: 'Placówka', value: user.organizationId ? <BusinessIdBadge type="organization" id={user.organizationId} /> : 'Globalna / Brak' },
                ]}
                actions={actionsFor(user, true)}
              />
            ))}
          </ObjectGrid>
        </div>
      ) : (
          <Table aria-label="Tabela użytkowników i ról IAM">
            <TableHeader className="text-muted-foreground">
              <TableRow>
                <TableHead scope="col">Użytkownik</TableHead>
                <TableHead scope="col">Placówka</TableHead>
                <TableHead scope="col">Rola</TableHead>
                <TableHead scope="col" className="text-right">Akcja</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => {
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{user.email}</span>
                        <BusinessIdBadge type="user" id={user.id} />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.organizationId ? (
                        <BusinessIdBadge type="organization" id={user.organizationId} />
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Globalna / Brak</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">{badgesFor(user)}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      {actionsFor(user)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
      )}
    </TableCard>
  )
}
