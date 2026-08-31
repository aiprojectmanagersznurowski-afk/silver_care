import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { InviteStaffDialog } from '@/components/InviteStaffDialog'
import { redirect } from 'next/navigation'

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Personel
          </h2>
          <p className="text-text-secondary">Zarządzaj zespołem w swojej placówce.</p>
        </div>
        <InviteStaffDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zatrudniony personel</CardTitle>
          <CardDescription>Pielęgniarki, pielęgniarze i sanitariusze</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 text-left align-middle font-medium text-text-secondary">E-mail</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-text-secondary">Rola</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-text-secondary">Ostatnie logowanie</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {staff.map((staffUser) => (
                  <tr key={staffUser.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle font-medium">
                      {staffUser.email}
                    </td>
                    <td className="p-4 align-middle">
                      {staffUser.app_metadata?.role === 'nurse' ? 'Pielęgniarka / Pielęgniarz' : 'Sanitariusz / Sanitariuszka'}
                    </td>
                    <td className="p-4 align-middle text-text-secondary">
                      {staffUser.last_sign_in_at 
                        ? new Date(staffUser.last_sign_in_at).toLocaleDateString('pl-PL') + ' ' + new Date(staffUser.last_sign_in_at).toLocaleTimeString('pl-PL')
                        : 'Nigdy'
                      }
                    </td>
                  </tr>
                ))}
                {staff.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-text-secondary">
                      Brak przypisanego personelu.
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
