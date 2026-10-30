export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSystemAlertsAction } from '@/actions/system-status'
import { SystemStatusManagementClient } from '@/components/system-status/SystemStatusManagementClient'
import { getCurrentUser } from '@/lib/supabase/current-user'

export default async function SystemStatusPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const role = user?.app_metadata?.role

  // Dostęp wyłącznie dla roli super_admin
  if (role !== 'super_admin') {
    redirect('/admin')
  }

  const { alerts } = await getSystemAlertsAction()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-semibold tracking-tight text-foreground">
          Status Systemu i Alerty
        </h2>
        <p className="mt-2 text-muted-foreground">
          Zarządzanie stanem technicznym platformy oraz publikowanie komunikatów serwisowych dla placówek.
        </p>
      </div>

      <SystemStatusManagementClient initialAlerts={alerts || []} />
    </div>
  )
}
