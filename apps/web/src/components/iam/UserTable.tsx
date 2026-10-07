'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Key } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { UserItem } from '@/components/IamManagementClient'
import { AddUserDialog } from './AddUserDialog'
import type { ComponentProps } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'

interface UserTableProps {
  users: UserItem[]
  selectedRoles: Record<string, string>
  onRoleSelect: (userId: string, newRole: string) => void
  onApplyRole: (userId: string) => void
  onResetPasswordClick: (user: UserItem) => void
  isPending: boolean
  availableRoles: { id: string; label: string }[]
  addUserProps: ComponentProps<typeof AddUserDialog>
}

export function UserTable({
  users,
  selectedRoles,
  onRoleSelect,
  onApplyRole,
  onResetPasswordClick,
  isPending,
  availableRoles,
  addUserProps,
}: UserTableProps) {
  return (
    <Card className="rounded-xl border-none ring-1 ring-border overflow-hidden">
      <CardHeader className="border-b border-border bg-card px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">Użytkownicy i Role</CardTitle>
            <CardDescription className="text-muted-foreground">
              Zarządzaj kontami użytkowników, przydziałem ról i uprawnień dostępowych.
            </CardDescription>
          </div>
        </div>

        <AddUserDialog {...addUserProps} />
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table aria-label="Tabela użytkowników i ról IAM">
            <TableHeader className="text-muted-foreground">
              <TableRow>
                <TableHead scope="col">Użytkownik</TableHead>
                <TableHead scope="col">Placówka</TableHead>
                <TableHead scope="col">Aktualna rola</TableHead>
                <TableHead scope="col">Nowa rola</TableHead>
                <TableHead scope="col" className="text-right">Akcja</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => {
                const currentSelected = selectedRoles[user.id] || user.role
                const hasChanged = currentSelected !== user.role
                const roleLabel = availableRoles.find(r => r.id === user.role)?.label || user.role

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium text-foreground text-base">{user.email}</div>
                      <div className="font-mono text-xs text-muted-foreground">{user.id}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.organizationId ? (
                        <BusinessIdBadge type="organization" id={user.organizationId} />
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Globalna / Brak</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                        {roleLabel}
                      </span>
                    </TableCell>
                    <TableCell>
                      <NativeSelect
                        aria-label={`Wybierz rolę dla ${user.email}`}
                        value={currentSelected}
                        onChange={e => onRoleSelect(user.id, e.target.value)}
                        className="min-w-[170px]"
                      >
                        {availableRoles.map(r => (
                          <NativeSelectOption key={r.id} value={r.id}>
                            {r.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onResetPasswordClick(user)}
                              className="min-h-[40px] rounded-xl border-border text-foreground hover:bg-muted/50"
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
                            <span>
                              <Button
                                disabled={!hasChanged || isPending}
                                onClick={() => onApplyRole(user.id)}
                                className="min-h-[40px] rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40"
                              >
                                Zastosuj
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {hasChanged ? 'Zapisz nową rolę w systemie' : 'Wybierz inną rolę z listy, aby zapisać'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
