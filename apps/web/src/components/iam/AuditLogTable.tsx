'use client'

import { History } from 'lucide-react'
import type { AuditLogItem, UserItem } from '@/components/IamManagementClient'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { TableCard } from '@/components/patterns/TableCard'
import { ListEmpty } from '@/components/patterns/ListState'

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
    return <StatusBadge>{roleDef ? roleDef.label : roleId}</StatusBadge>
  }

  return (
    <TableCard
      icon={<History />}
      title="Dziennik Audytowy Zmian Uprawnień"
      description="Historia wszystkich modyfikacji ról, uprawnień i kont personelu."
    >
        {auditLogs.length === 0 ? (
          <ListEmpty framed={false} title="Brak wpisów audytowych" description="W bieżącym widoku nie zarejestrowano zmian uprawnień." />
        ) : (
            <Table>
              <TableHeader className="font-medium text-muted-foreground">
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
                    <TableRow key={log.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        <StatusBadge>{log.action}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{targetEmail}</span>
                          {log.payload?.target_user_id && <BusinessIdBadge type="user" id={log.payload.target_user_id} />}
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.action === 'role_change' && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {log.payload.previous_role && (
                              <>
                                {getRoleBadge(log.payload.previous_role)}
                                <span className="text-muted-foreground">→</span>
                              </>
                            )}
                            {getRoleBadge(log.payload.new_role)}
                          </div>
                        )}
                        {log.action === 'password_reset' && (
                          <span className="text-muted-foreground">Reset i aktualizacja hasła konta</span>
                        )}
                        {log.action === 'USER_DEACTIVATED' && (
                          <span className="text-muted-foreground font-medium">Blokada konta (deaktywacja)</span>
                        )}
                        {log.action === 'USER_ACTIVATED' && (
                          <span className="text-primary font-medium">Odblokowanie konta (reaktywacja)</span>
                        )}
                        {log.action === 'USER_HARD_DELETED' && (
                          <span className="text-destructive font-medium">Trwałe usunięcie konta z bazy</span>
                        )}
                        {log.action !== 'role_change' &&
                          log.action !== 'password_reset' &&
                          log.action !== 'USER_DEACTIVATED' &&
                          log.action !== 'USER_ACTIVATED' &&
                          log.action !== 'USER_HARD_DELETED' && (
                          <span className="font-mono text-sm text-muted-foreground">
                            {JSON.stringify(log.payload)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.performed_by && log.performed_by.toLowerCase() !== 'system' ? (
                          <div className="flex flex-col gap-1 items-start">
                            {users.find(u => u.id === log.performed_by)?.email && (
                              <span className="font-medium text-foreground text-sm">
                                {users.find(u => u.id === log.performed_by)!.email}
                              </span>
                            )}
                            <BusinessIdBadge type="user" id={log.performed_by} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-sm">system</span>
                        )}
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
