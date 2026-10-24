import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { isImpersonationSessionActive } from '@/lib/impersonation-guards'
import { InviteStaffDialog } from '@/components/InviteStaffDialog'
import { PageHeader, PageHeaderNotice } from '@/components/patterns/PageHeader'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { TableCard, TableStateRow } from '@/components/patterns/TableCard'
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
    u.app_metadata?.role === 'nurse'
  )

  const cookieStore = await cookies()
  const isImpersonating = isImpersonationSessionActive(cookieStore, user)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Personel"
        description="Zarządzaj zespołem wsparcia i personelu opiekuńczego."
        actions={!isImpersonating ? (
          <InviteStaffDialog />
        ) : (
          <PageHeaderNotice>Tryb podglądu (impersonacja) — dodawanie personelu wyłączone</PageHeaderNotice>
        )}
      />

      <TableCard>
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
                            <div className="mt-1"><StatusBadge>Zarchiwizowany</StatusBadge></div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">
                      Personel opiekuńczy / Wsparcie
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
                {error ? (
                  <TableStateRow colSpan={4} state="error" description="Lista personelu jest chwilowo niedostępna. Odśwież stronę za chwilę." />
                ) : staff.length === 0 && (
                  <TableStateRow
                    colSpan={4}
                    state="empty"
                    title="Brak przypisanego personelu"
                    description="Zaproś pracowników za pomocą przycisku powyżej."
                  />
                )}
              </TableBody>
            </Table>
      </TableCard>
    </div>
  )
}
