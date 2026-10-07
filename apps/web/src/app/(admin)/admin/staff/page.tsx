import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { isImpersonationSessionActive } from '@/lib/impersonation-guards'
import { Card, CardContent } from '@/components/ui/card'
import { InviteStaffDialog } from '@/components/InviteStaffDialog'
import { redirect } from 'next/navigation'
import { deleteStaffAction } from '@/actions/admin'
import { Trash2, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StaffActionsMenu } from '@/components/StaffActionsMenu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function AdminStaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const role = user?.app_metadata?.role || user?.user_metadata?.role
  const orgId = user?.app_metadata?.organization_id

  if (!user || (role !== 'admin' && role !== 'org_admin' && role !== 'super_admin')) {
    redirect('/')
  }

  const adminClient = createAdminClient()
  const { data: { users }, error } = await adminClient.auth.admin.listUsers()

  if (error) {
    console.error('Error fetching users:', error)
  }

  const staff = (users || []).filter(u => 
    (!orgId || u.app_metadata?.organization_id === orgId) &&
    (u.app_metadata?.role === 'nurse' || u.app_metadata?.role === 'paramedic')
  )

  const cookieStore = await cookies()
  const isImpersonating = isImpersonationSessionActive(cookieStore, user)

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-semibold tracking-tight text-foreground">
            Personel
          </h2>
          <p className="mt-2 text-muted-foreground">Zarządzaj zespołem opiekunów i pielęgniarek.</p>
        </div>
        {!isImpersonating ? (
          <InviteStaffDialog />
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-xs font-medium text-foreground border border-border">
            <span>Tryb podglądu (impersonacja) — dodawanie personelu wyłączone</span>
          </div>
        )}
      </div>

      <Card className="rounded-xl border-none ring-1 ring-border overflow-hidden">
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader className="text-muted-foreground">
                <TableRow>
                  <TableHead>Pracownik</TableHead>
                  <TableHead>Rola</TableHead>
                  <TableHead>Ostatnie logowanie</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((staffUser) => (
                  <TableRow key={staffUser.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-border">
                          {staffUser.user_metadata?.avatar_url && (
                            <AvatarImage src={staffUser.user_metadata.avatar_url} alt={staffUser.email} />
                          )}
                          <AvatarFallback className="bg-primary/10 text-primary">
                            <UserCog className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-foreground text-base">{staffUser.email}</div>
                          {staffUser.app_metadata?.is_active === false && (
                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground mt-1">
                              Zarchiwizowany
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {staffUser.app_metadata?.role === 'nurse' ? 'Pielęgniarka / Pielęgniarz' : 'Sanitariusz / Sanitariuszka'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {staffUser.last_sign_in_at 
                        ? new Date(staffUser.last_sign_in_at).toLocaleDateString('pl-PL') + ' ' + new Date(staffUser.last_sign_in_at).toLocaleTimeString('pl-PL')
                        : 'Nigdy'
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2 items-center">
                        <StaffActionsMenu
                          staffId={staffUser.id}
                          email={staffUser.email}
                          isActive={staffUser.app_metadata?.is_active !== false}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {staff.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Brak przypisanego personelu. Zaproś pracowników za pomocą przycisku powyżej.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
