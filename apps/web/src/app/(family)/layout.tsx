import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReactNode } from 'react'
import { FamilyHeader } from '@/components/FamilyHeader'
import { OnboardingModal } from '@/components/OnboardingModal'
import { getAppRole } from '@/lib/auth/app-role'
import { getCurrentUser } from '@/lib/supabase/current-user'

export const dynamic = 'force-dynamic'
export default async function FamilyLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const user = await getCurrentUser()

  const role = getAppRole(user)

  if (!user || (role !== 'family' && role !== 'legal_guardian')) {
    redirect('/')
  }

  // Fetch linked residents for the user
  const { data: links } = await supabase
    .from('resident_relative_links')
    .select(`
      resident_id,
      residents (
        id,
        first_name,
        last_name,
        avatar_url
      )`)
    .eq('relative_user_id', user.id)

  const residents = (links || []).map(link => 
    Array.isArray(link.residents) ? link.residents[0] : link.residents
  ).filter(Boolean) as { id: string; first_name: string; last_name: string; avatar_url: string | null }[]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <FamilyHeader residents={residents} />
      <OnboardingModal />
      
      {/* Main content area */}
      <main className="flex-1 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:p-6 lg:pb-6">
        <div className="mx-auto w-full max-w-screen-2xl">
          {children}
        </div>
      </main>
    </div>
  )
}
