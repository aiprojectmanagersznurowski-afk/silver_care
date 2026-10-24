export const dynamic = 'force-dynamic'
import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { AdminSidebar } from '@/components/AdminSidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppHeader } from '@/components/patterns/AppHeader'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import { SystemAlertBanner } from '@/components/SystemAlertBanner'
import { getActiveImpersonation } from '@/lib/impersonation-guards'
import { GlobalCommandPalette } from '@/components/GlobalCommandPalette'
import { StaffNotificationBell } from '@/components/StaffNotificationBell'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.app_metadata?.role || user?.user_metadata?.role
  if (!user || (role !== 'admin' && role !== 'org_admin' && role !== 'facility_manager' && role !== 'super_admin')) {
    redirect('/')
  }

  const cookieStore = await cookies()
  const impersonationSession = getActiveImpersonation(cookieStore, user)

  const sidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <SidebarProvider defaultOpen={sidebarOpen} style={{ '--sidebar-width': 'calc(var(--spacing) * 68)' } as React.CSSProperties}>
      <AdminSidebar
        userEmail={user.email || ''}
        role={role}
        isImpersonating={!!impersonationSession}
      />
      <SidebarInset className="min-w-0 overflow-x-clip">
        {impersonationSession && <ImpersonationBanner session={impersonationSession} />}
        <SystemAlertBanner role={role} />
        <AppHeader
          search={<GlobalCommandPalette userRole={role} />}
          actions={role !== 'super_admin' ? <StaffNotificationBell /> : undefined}
        />
        <div className="flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
