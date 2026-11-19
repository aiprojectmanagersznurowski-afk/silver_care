import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReactNode } from 'react'
import { FamilyHeader } from '@/components/FamilyHeader'
import { OnboardingModal } from '@/components/OnboardingModal'
import { getAppRole } from '@/lib/auth/app-role'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { getFamilyResidents } from '@/lib/family-residents'

export const dynamic = 'force-dynamic'
export default async function FamilyLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const user = await getCurrentUser()

  const role = getAppRole(user)

  if (!user || (role !== 'family' && role !== 'legal_guardian')) {
    redirect('/')
  }

  // SC-FAM-08: podopieczni wyłącznie z get_family_resident_overview (bez odczytu tabeli residents).
  // Przy błędzie nagłówek pokazuje „Konto”; strony portalu zgłaszają błąd jawnie.
  const overview = await getFamilyResidents(supabase)
  const residents = overview.status === 'ok' ? overview.residents : []

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
