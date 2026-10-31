export const dynamic = 'force-dynamic'
import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { StaffSidebar } from '@/components/StaffSidebar'
import { cookies } from 'next/headers'
import { GlobalCommandPalette } from '@/components/GlobalCommandPalette'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppHeader } from '@/components/patterns/AppHeader'
import { StaffVoiceSyncListener } from '@/components/staff/StaffVoiceSyncListener'
import { SystemAlertBanner } from '@/components/SystemAlertBanner'
import { getAppRole } from '@/lib/auth/app-role'
import { getCurrentUser } from '@/lib/supabase/current-user'

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()

  const role = getAppRole(user)
  if (!user || (role !== 'nurse' && role !== 'org_admin' && role !== 'super_admin')) {
    redirect('/')
  }

  const cookieStore = await cookies()
  const sidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <SidebarProvider defaultOpen={sidebarOpen} style={{ '--sidebar-width': 'calc(var(--spacing) * 68)' } as React.CSSProperties}>
      <StaffSidebar userEmail={user?.email} />
      <SidebarInset className="min-w-0 overflow-x-clip">
        <SystemAlertBanner role={role} />
        <AppHeader search={<GlobalCommandPalette userRole={role} />} />
        <div className="flex-1 p-4 md:p-6">
          <StaffVoiceSyncListener />
          <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
