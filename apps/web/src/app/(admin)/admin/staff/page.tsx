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
  const isImpersonating = isImpersonationSessionActive(cookieStore)

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-semibold tracking-tight text-slate">
            Personel
          </h2>
          <p className="mt-2 text-slate-soft">Zarządzaj zespołem opiekunów i pielęgniarek.</p>
        </div>
        {!isImpersonating ? (
          <InviteStaffDialog />
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 border border-amber-500/20">
            <span>Tryb podglądu (impersonacja) — dodawanie personelu wyłączone</span>
          </div>
        )}
      </div>

      <Card className="rounded-xl border-none ring-1 ring-slate/5 overflow-hidden">
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader className="text-slate-soft">
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
                        <Avatar className="h-10 w-10 border border-slate/10">
                          {staffUser.user_metadata?.avatar_url && (
                            <AvatarImage src={staffUser.user_metadata.avatar_url} alt={staffUser.email} />
                          )}
                          <AvatarFallback className="bg-sage/10 text-sage">
                            <UserCog className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-slate text-base">{staffUser.email}</div>
                          {staffUser.app_metadata?.is_active === false && (
                            <span className="inline-flex items-center rounded-md bg-slate/10 px-2 py-0.5 text-[10px] font-medium text-slate-soft mt-1">
                              Zarchiwizowany
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate">
                      {staffUser.app_metadata?.role === 'nurse' ? 'Pielęgniarka / Pielęgniarz' : 'Sanitariusz / Sanitariuszka'}
                    </TableCell>
                    <TableCell className="text-slate-soft">
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
                    <TableCell colSpan={4} className="text-center text-slate-soft">
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
