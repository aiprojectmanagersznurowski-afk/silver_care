import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
    <Card className="rounded-xl border-none ring-1 ring-border overflow-hidden">
      <CardHeader className="border-b border-border bg-card px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <UserCog className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Administratorzy Ośrodka (org_admin)</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              Konta posiadające uprawnienia do zarządzania personelem, podopiecznymi i salami w tej placówce.
            </CardDescription>
          </div>
          <AddAdminToOrgDialog
            organizationId={organizationId}
            organizationName={organizationName}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
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
                          className="rounded-xl border-border bg-muted text-foreground hover:bg-muted text-sm min-h-11 font-medium"
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
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Brak przypisanych administratorów placówki.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
