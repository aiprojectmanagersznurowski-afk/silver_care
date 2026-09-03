import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GlobalResidentSwitcher } from '@/components/GlobalResidentSwitcher'
import { ReactNode } from 'react'
import { FamilyHeader } from '@/components/FamilyHeader'

export const dynamic = 'force-dynamic'
export default async function FamilyLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.user_metadata?.role || user?.app_metadata?.role

  if (!user || role !== 'family') {
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
    <div className="flex min-h-screen flex-col bg-surface-sunken">
      <FamilyHeader residents={residents} />
      
      {/* Main content area */}
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl">
          {children}
        </div>
      </main>
    </div>
  )
}
