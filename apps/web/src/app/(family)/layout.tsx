import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GlobalResidentSwitcher } from '@/components/GlobalResidentSwitcher'
import { ReactNode } from 'react'

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
      {/* Mobile-first top navigation / header */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-2xl flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              Silver Care
            </h1>
            <form action="/auth/signout" method="post" className="sm:hidden">
              <button type="submit" className="text-sm font-medium text-text-secondary hover:text-foreground">
                Wyloguj
              </button>
            </form>
          </div>
          <nav className="flex items-center space-x-4 text-sm font-medium text-text-secondary overflow-x-auto pb-1 sm:pb-0">
            <a href="/dashboard" className="hover:text-foreground whitespace-nowrap">Pulpit</a>
            <a href="/agenda" className="hover:text-foreground whitespace-nowrap">Plan Dnia</a>
            <a href="/messages" className="hover:text-foreground whitespace-nowrap">Wiadomości</a>
            <form action="/auth/signout" method="post" className="hidden sm:block ml-4">
              <button type="submit" className="text-sm font-medium text-text-secondary hover:text-foreground">
                Wyloguj
              </button>
            </form>
          </nav>
        </div>
      </header>

      {residents.length > 0 && (
        <div className="mx-auto w-full max-w-2xl">
          <GlobalResidentSwitcher residents={residents} />
        </div>
      )}

      {/* Main content area */}
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl">
          {children}
        </div>
      </main>
    </div>
  )
}
