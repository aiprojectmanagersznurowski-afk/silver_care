'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Key, ShieldAlert } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { UserItem } from '@/components/IamManagementClient'
import { AddUserDialog } from './AddUserDialog'
import type { ComponentProps } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface UserTableProps {
  users: UserItem[]
  onChangeRoleClick: (user: UserItem) => void
  onResetPasswordClick: (user: UserItem) => void
  roleLabels: Record<string, string>
  addUserProps: ComponentProps<typeof AddUserDialog>
}

export function UserTable({
  users,
  onChangeRoleClick,
  onResetPasswordClick,
  roleLabels,
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
                <TableHead scope="col">Rola</TableHead>
                <TableHead scope="col" className="text-right">Akcja</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => {
                const displayRole = roleLabels[user.role] || user.role

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium text-foreground text-base">{user.email}</div>
                      <div className="font-mono text-xs text-muted-foreground">{user.id}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono">
                      {user.organizationId || 'Globalna / Brak'}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                        {displayRole}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onChangeRoleClick(user)}
                              className="min-h-[40px] rounded-xl border-border text-foreground hover:bg-muted/50"
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
