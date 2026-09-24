'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Key } from 'lucide-react'
import type { UserItem } from '@/components/IamManagementClient'
import { AddUserDialog } from './AddUserDialog'
import type { ComponentProps } from 'react'

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
    <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5 overflow-hidden">
      <CardHeader className="border-b border-slate/5 bg-white px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage/10 text-sage shrink-0">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-slate">Użytkownicy i Role</CardTitle>
            <CardDescription className="text-slate-soft">
              Zarządzaj kontami użytkowników, przydziałem ról i uprawnień dostępowych.
            </CardDescription>
          </div>
        </div>

        <AddUserDialog {...addUserProps} />
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-label="Tabela użytkowników i ról IAM">
            <thead className="bg-slate/5 text-slate-soft">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium">Użytkownik</th>
                <th scope="col" className="px-6 py-4 font-medium">Placówka</th>
                <th scope="col" className="px-6 py-4 font-medium">Aktualna rola</th>
                <th scope="col" className="px-6 py-4 font-medium">Nowa rola</th>
                <th scope="col" className="px-6 py-4 font-medium text-right">Akcja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate/5 bg-white">
              {users.map(user => {
                const currentSelected = selectedRoles[user.id] || user.role
                const hasChanged = currentSelected !== user.role

                return (
                  <tr key={user.id} className="transition-colors hover:bg-slate/5">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate text-base">{user.email}</div>
                      <div className="font-mono text-xs text-slate-soft">{user.id}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-soft font-mono text-xs">
                      {user.organizationId || 'Globalna / Brak'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-lg bg-slate/10 px-2.5 py-1 text-xs font-medium text-slate">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        aria-label={`Wybierz rolę dla ${user.email}`}
                        value={currentSelected}
                        onChange={e => onRoleSelect(user.id, e.target.value)}
                        className="min-h-[44px] rounded-xl border border-slate/20 bg-white px-3 py-2 text-sm text-slate focus:border-sage focus:outline-none focus:ring-1 focus:ring-sage"
                      >
                        {availableRoles.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onResetPasswordClick(user)}
                          className="min-h-[40px] rounded-xl border-slate/20 text-slate hover:bg-slate/5"
                          title="Resetuj lub nadaj nowe hasło"
                        >
                          <Key className="h-4 w-4 mr-1.5 text-slate-soft" />
                          Hasło
                        </Button>
                        <Button
                          disabled={!hasChanged || isPending}
                          onClick={() => onApplyRole(user.id)}
                          className="min-h-[40px] rounded-xl bg-sage px-4 text-sm font-medium text-white shadow-sm hover:bg-sage/90 disabled:opacity-40"
                        >
                          Zastosuj
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
