export const dynamic = 'force-dynamic'
import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/AdminSidebar'
import { AdminMobileHeader } from '@/components/AdminMobileHeader'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.user_metadata?.role || user?.app_metadata?.role
  if (!user || (role !== 'admin' && role !== 'org_admin' && role !== 'facility_manager')) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen bg-cream font-sans text-slate">
      {/* Sidebar for desktop */}
      <AdminSidebar userEmail={user.email || ''} />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <AdminMobileHeader userEmail={user.email || ''} />
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
