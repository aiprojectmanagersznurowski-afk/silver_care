export const dynamic = 'force-dynamic'
import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StaffSidebar } from '@/components/StaffSidebar'
import { StaffMobileHeader } from '@/components/StaffMobileHeader'

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.user_metadata?.role || user?.app_metadata?.role
  if (!user || (role !== 'nurse' && role !== 'paramedic' && role !== 'admin' && role !== 'org_admin' && role !== 'facility_manager')) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-cream selection:bg-sage/30">
      <StaffSidebar userEmail={user?.email} />
      <StaffMobileHeader userEmail={user?.email} />

      <main className="lg:pl-72 flex flex-col min-h-screen">
        <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
