import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { isImpersonationSessionActive } from '@/lib/impersonation-guards'
import { InviteStaffDialog } from '@/components/InviteStaffDialog'
import { PageHeader, PageHeaderNotice } from '@/components/patterns/PageHeader'
import { StaffListView, type StaffListItem } from '@/components/staff/StaffListView'
import { redirect } from 'next/navigation'

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

  const staffItems: StaffListItem[] = staff.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    isActive: u.app_metadata?.is_active !== false,
    avatarUrl: (u.user_metadata?.avatar_url as string | undefined) ?? null,
    lastSignInLabel: u.last_sign_in_at
      ? new Date(u.last_sign_in_at).toLocaleDateString('pl-PL') + ' ' + new Date(u.last_sign_in_at).toLocaleTimeString('pl-PL')
      : 'Nigdy',
  }))

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

      <StaffListView staff={staffItems} failed={Boolean(error)} />
    </div>
  )
}
