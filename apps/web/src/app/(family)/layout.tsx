import { requireOrgFeature } from '@/lib/feature-flags'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReactNode } from 'react'
import { FamilyHeader } from '@/components/FamilyHeader'
import { OnboardingModal } from '@/components/OnboardingModal'
import { getAppRole } from '@/lib/auth/app-role'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { getFamilyResidents } from '@/lib/family-residents'
import { residentPhotoUrls } from '@/lib/resident-photo'

export const dynamic = 'force-dynamic'
export default async function FamilyLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()

  const role = getAppRole(user)

  if (!user || (role !== 'family' && role !== 'legal_guardian')) {
    redirect('/')
  }

  if (!(await requireOrgFeature('module_family_portal')).allowed) {
    return <main className="mx-auto max-w-screen-md p-4 md:p-6"><FeatureDisabledState signOut /></main>
  }

  const supabase = await createClient()
  // SC-FAM-08: podopieczni wyłącznie z get_family_resident_overview (bez odczytu tabeli residents).
  // Przy błędzie nagłówek pokazuje „Konto”; strony portalu zgłaszają błąd jawnie.
  const overview = await getFamilyResidents(supabase)
  const listed = overview.status === 'ok' ? overview.residents : []
  // SC-ADM-25: zdjęcie z prywatnego bucketu przez podpisany link (o odczycie bliskiego decyduje RLS storage).
  // RPC przed migracją 20261117130000 zwraca jeszcze avatar_url — wtedy zostaje dotychczasowy adres.
  const photoUrls = await residentPhotoUrls(supabase, listed.map((r) => r.photo_path))
  const residents = listed.map((r) => ({ ...r, avatar_url: r.photo_path ? photoUrls[r.photo_path] ?? null : r.avatar_url ?? null }))

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
