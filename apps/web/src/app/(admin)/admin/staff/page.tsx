import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { InviteStaffDialog } from '@/components/InviteStaffDialog'
import { redirect } from 'next/navigation'
import { deleteStaffAction } from '@/actions/admin'
import { Trash2, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default async function AdminStaffPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const role = user?.user_metadata?.role || user?.app_metadata?.role
  const orgId = user?.app_metadata?.organization_id

  if (!orgId || (role !== 'admin' && role !== 'org_admin')) {
    redirect('/')
  }

  const adminClient = createAdminClient()
  const { data: { users }, error } = await adminClient.auth.admin.listUsers()

  if (error) {
    console.error('Error fetching users:', error)
  }

  const staff = (users || []).filter(u => 
    u.app_metadata?.organization_id === orgId &&
    (u.app_metadata?.role === 'nurse' || u.app_metadata?.role === 'paramedic')
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-semibold tracking-tight text-slate">
            Personel
          </h2>
          <p className="mt-2 text-slate-soft">Zarządzaj zespołem opiekunów i pielęgniarek.</p>
        </div>
        <InviteStaffDialog />
      </div>

      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5 overflow-hidden">
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate/5 text-slate-soft">
                <tr>
                  <th className="px-6 py-4 font-medium">Pracownik</th>
                  <th className="px-6 py-4 font-medium">Rola</th>
                  <th className="px-6 py-4 font-medium">Ostatnie logowanie</th>
                  <th className="px-6 py-4 font-medium text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/5 bg-white">
                {staff.map((staffUser) => (
                  <tr key={staffUser.id} className="transition-colors hover:bg-slate/5">
                    <td className="px-6 py-4">
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
                    </td>
                    <td className="px-6 py-4 text-slate">
                      {staffUser.app_metadata?.role === 'nurse' ? 'Pielęgniarka / Pielęgniarz' : 'Sanitariusz / Sanitariuszka'}
                    </td>
                    <td className="px-6 py-4 text-slate-soft">
                      {staffUser.last_sign_in_at 
                        ? new Date(staffUser.last_sign_in_at).toLocaleDateString('pl-PL') + ' ' + new Date(staffUser.last_sign_in_at).toLocaleTimeString('pl-PL')
                        : 'Nigdy'
                      }
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2 items-center">
                        {staffUser.app_metadata?.is_active !== false && (
                          <form action={deleteStaffAction}>
                            <input type="hidden" name="id" value={staffUser.id} />
                            <Button variant="ghost" size="icon" type="submit" title="Zarchiwizuj konto personelu" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-9 w-9 rounded-xl">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {staff.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-soft">
                      Brak przypisanego personelu. Zaproś pracowników za pomocą przycisku powyżej.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
