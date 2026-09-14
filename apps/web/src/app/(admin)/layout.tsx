export const dynamic = 'force-dynamic'
import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminMobileHeader } from '@/components/AdminMobileHeader'
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

  return (
    <div className="flex flex-col min-h-screen bg-cream font-sans text-slate">
      {impersonationSession && <ImpersonationBanner session={impersonationSession} />}

      <div className="flex flex-1 min-h-0">
        {/* Sidebar for desktop */}
        <AdminSidebar userEmail={user.email || ''} role={role} />

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile header */}
          <AdminMobileHeader userEmail={user.email || ''} role={role} />
          
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
