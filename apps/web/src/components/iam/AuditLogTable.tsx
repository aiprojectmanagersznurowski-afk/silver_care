'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { History } from 'lucide-react'
import type { AuditLogItem, UserItem } from '@/components/IamManagementClient'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface AuditLogTableProps {
  auditLogs: AuditLogItem[]
  users: UserItem[]
  availableRoles: { id: string; label: string }[]
  formatDateTime: (dtString?: string | null) => string
}

export function AuditLogTable({
  auditLogs,
  users,
  availableRoles,
  formatDateTime,
}: AuditLogTableProps) {
  const getRoleBadge = (roleId?: string | null) => {
    if (!roleId) return null
    const roleDef = availableRoles.find(r => r.id === roleId)
    const label = roleDef ? roleDef.label : roleId

    let colorClass = 'bg-slate/10 text-slate'
    if (roleId === 'super_admin') colorClass = 'bg-amber/10 text-amber'
    if (roleId === 'org_admin') colorClass = 'bg-teal/10 text-teal'
    if (roleId === 'nurse') colorClass = 'bg-sage/10 text-sage'

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {label}
      </span>
    )
  }

  return (
    <Card className="rounded-xl border-none ring-1 ring-slate/5 overflow-hidden">
      <CardHeader className="border-b border-slate/5 bg-white px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate/5 text-slate-soft shrink-0">
            <History className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-slate">Dziennik Audytowy Zmian Uprawnień</CardTitle>
            <CardDescription className="text-slate-soft">
              Historia wszystkich modyfikacji ról, uprawnień i kont personelu.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-soft">
            Brak zarejestrowanych wpisów audytowych w bieżącym widoku.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="font-medium text-slate-soft">
                <TableRow>
                  <TableHead>Czas operacji</TableHead>
                  <TableHead>Typ zdarzenia</TableHead>
                  <TableHead>Użytkownik docelowy</TableHead>
                  <TableHead>Szczegóły zmiany</TableHead>
                  <TableHead>Operator</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map(log => {
                  const targetUser = users.find(u => u.id === log.payload?.target_user_id)
                  const targetEmail = targetUser ? targetUser.email : (log.payload?.target_user_id || '—')

                  return (
                    <TableRow key={log.id} className="hover:bg-slate/[0.02]">
                      <TableCell className="font-mono text-slate-soft whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate/10 text-slate">
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate">{targetEmail}</div>
                        {log.payload?.target_user_id && (
                          <div className="font-mono text-[0.65rem] text-slate-soft truncate max-w-[120px]">
                            {log.payload.target_user_id}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.action === 'role_change' && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {log.payload.previous_role && (
                              <>
                                {getRoleBadge(log.payload.previous_role)}
                                <span className="text-slate-soft">→</span>
                              </>
                            )}
                            {getRoleBadge(log.payload.new_role)}
                          </div>
                        )}
                        {log.action === 'password_reset' && (
                          <span className="text-slate-soft">Reset i aktualizacja hasła konta</span>
                        )}
                        {log.action !== 'role_change' && log.action !== 'password_reset' && (
                          <span className="font-mono text-[0.7rem] text-slate-soft">
                            {JSON.stringify(log.payload)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-soft">
                        {log.performed_by || 'system'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
