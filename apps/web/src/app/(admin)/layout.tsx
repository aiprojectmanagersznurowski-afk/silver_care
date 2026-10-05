export const dynamic = 'force-dynamic'
import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { AdminSidebar } from '@/components/AdminSidebar'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import { ImpersonationSession } from '@/actions/impersonation'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.app_metadata?.role || user?.user_metadata?.role
  if (!user || (role !== 'admin' && role !== 'org_admin' && role !== 'facility_manager' && role !== 'super_admin')) {
    redirect('/')
  }

  const cookieStore = await cookies()
  const rawSession = cookieStore.get('sc_impersonation')?.value
  let impersonationSession: ImpersonationSession | null = null
  if (rawSession) {
    try {
      impersonationSession = JSON.parse(rawSession)
    } catch {
      impersonationSession = null
    }
  }

  const sidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AdminSidebar
        userEmail={user.email || ''}
        role={role}
        isImpersonating={!!impersonationSession}
      />
      <SidebarInset className="min-w-0 overflow-x-clip">
        {impersonationSession && <ImpersonationBanner session={impersonationSession} />}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b">
          <div className="flex w-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ml-1" aria-label="Zwiń lub rozwiń menu" />
              <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center" />
              <span className="text-sm font-medium">{role === 'super_admin' && !impersonationSession ? 'Panel platformy' : 'Panel placówki'}</span>
            </div>
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
