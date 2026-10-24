import { TableCard, TableStateRow } from '@/components/patterns/TableCard'
import { Button } from '@/components/ui/button'
import { UserCog } from 'lucide-react'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { startImpersonationAction } from '@/actions/impersonation'
import { ResendAdminInviteButton, AddAdminToOrgDialog } from '@/components/AdminInviteActions'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { User } from '@supabase/supabase-js'
import { StatusBadge } from '@/components/patterns/StatusBadge'

interface OrganizationAdminsSectionProps {
  organizationId: string
  organizationName: string
  administrators: User[]
}

export function OrganizationAdminsSection({
  organizationId,
  organizationName,
  administrators
}: OrganizationAdminsSectionProps) {
  return (
    <TableCard
      icon={<UserCog />}
      title="Administratorzy Ośrodka (org_admin)"
      description="Konta posiadające uprawnienia do zarządzania personelem, podopiecznymi i salami w tej placówce."
      actions={<AddAdminToOrgDialog organizationId={organizationId} organizationName={organizationName} />}
    >
          <Table>
            <TableHeader className="text-muted-foreground">
              <TableRow>
                <TableHead scope="col">Użytkownik</TableHead>
                <TableHead scope="col">Rola</TableHead>
                <TableHead scope="col">Data rejestracji</TableHead>
                <TableHead scope="col">Ostatnie logowanie</TableHead>
                <TableHead scope="col" className="text-right">Akcja</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {administrators.map(admin => (
                <TableRow key={admin.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{admin.email}</div>
                    <div className="mt-1">
                      <BusinessIdBadge type="user" id={admin.id} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone="brand">Administrator Ośrodka</StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(admin.created_at).toLocaleDateString('pl-PL')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {admin.last_sign_in_at
                      ? new Date(admin.last_sign_in_at).toLocaleString('pl-PL')
                      : 'Nigdy'
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ResendAdminInviteButton
                        adminEmail={admin.email || ''}
                        organizationId={organizationId}
                        organizationName={organizationName}
                      />
                      <form action={startImpersonationAction}>
                        <input type="hidden" name="targetAdminId" value={admin.id} />
                        <input type="hidden" name="targetOrgId" value={organizationId} />
                        <input type="hidden" name="targetOrgName" value={organizationName} />
                        <input type="hidden" name="adminEmail" value={admin.email || ''} />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-border bg-muted text-foreground hover:bg-muted text-sm min-h-touch font-medium"
                          title="Zaloguj jako ten administrator placówki"
                        >
                          Zaloguj jako
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {administrators.length === 0 && (
                <TableStateRow colSpan={5} state="empty" title="Brak przypisanych administratorów placówki" />
              )}
            </TableBody>
          </Table>
    </TableCard>
  )
}
