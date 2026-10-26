export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { IamManagementClient, UserItem, AuditLogItem } from '@/components/IamManagementClient'
import { PageHeader } from '@/components/patterns/PageHeader'
import { getAppRole } from '@/lib/auth/app-role'

export default async function IamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = getAppRole(user)

  // AC1: Panel widoczny i dostępny wyłącznie dla konta o roli super_admin
  if (role !== 'super_admin') {
    redirect('/admin')
  }

  let users: UserItem[] = []
  let auditLogs: AuditLogItem[] = []
  let errorMessage: string | undefined

  try {
    const adminClient = createAdminClient()
    const { data: userData, error: userError } = await adminClient.auth.admin.listUsers()

    if (userError) {
      console.error('Błąd pobierania użytkowników:', userError)
      errorMessage = userError.message
    } else {
      users = (userData?.users || []).map(u => {
        const isBanned = Boolean(u.banned_until && new Date(u.banned_until) > new Date())
        const isActive = u.app_metadata?.is_active !== false && !isBanned

        return {
          id: u.id,
          email: u.email || 'Brak emaila',
          role: u.app_metadata?.role || 'brak',
          organizationId: u.app_metadata?.organization_id || null,
          lastSignInAt: u.last_sign_in_at || null,
          isActive
        }
      })
    }

    // AC3: Widok audytu zmian uprawnień zintegrowany z audit_logs
    const { data: logsData, error: logsError } = await supabase
      .from('audit_logs')
      .select('id, action, performed_by, payload, created_at')
      .in('action', ['role_change', 'USER_DEACTIVATED', 'USER_ACTIVATED', 'USER_HARD_DELETED', 'password_reset'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (logsError) {
      console.error('Błąd pobierania logów audytowych IAM:', logsError)
    } else {
      auditLogs = (logsData || []) as AuditLogItem[]
    }
  } catch (err: unknown) {
    errorMessage = err instanceof Error ? err.message : 'Nieoczekiwany błąd serwera'
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Zarządzanie Dostępem i Tożsamością (IAM)"
        description="Kontrola ról systemowych, zarządzanie dostępami użytkowników oraz rejestr audytowy zmian uprawnień."
      />

      <IamManagementClient
        initialUsers={users}
        initialAuditLogs={auditLogs}
        currentUserId={user.id}
        errorMessage={errorMessage}
      />
    </div>
  )
}
