export const dynamic = 'force-dynamic'
import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { AdminSidebar } from '@/components/AdminSidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppHeader } from '@/components/patterns/AppHeader'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import { SystemAlertBanner } from '@/components/SystemAlertBanner'
import { getActiveImpersonation } from '@/lib/impersonation-guards'
import { availableSearchCategories } from '@/lib/global-search-features'
import { GlobalCommandPalette } from '@/components/GlobalCommandPalette'
import { StaffNotificationBell } from '@/components/StaffNotificationBell'
import { getAppRole } from '@/lib/auth/app-role'
import { getCurrentFeatureFlags } from '@/lib/feature-flags'
import { getCurrentUser } from '@/lib/supabase/current-user'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()

  const role = getAppRole(user)
  if (!user || (role !== 'org_admin' && role !== 'super_admin')) {
    redirect('/')
  }

  const cookieStore = await cookies()
  const impersonationSession = getActiveImpersonation(cookieStore, user)

  const flags = (await getCurrentFeatureFlags())?.flags ?? null
  const sidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <SidebarProvider defaultOpen={sidebarOpen} style={{ '--sidebar-width': 'calc(var(--spacing) * 68)' } as React.CSSProperties}>
      <AdminSidebar
        userEmail={user.email || ''}
        role={role}
        isImpersonating={!!impersonationSession}
        flags={flags}
      />
      <SidebarInset className="min-w-0 overflow-x-clip">
        {impersonationSession && <ImpersonationBanner session={impersonationSession} />}
        <SystemAlertBanner role={role} />
        <AppHeader
          search={<GlobalCommandPalette categories={availableSearchCategories(role, flags)} />}
          actions={role !== 'super_admin' && flags?.module_family_portal ? <StaffNotificationBell /> : undefined}
        />
        <div className="flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
