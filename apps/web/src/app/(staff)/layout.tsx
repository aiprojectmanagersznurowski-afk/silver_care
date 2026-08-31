import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || (user.user_metadata?.role !== 'nurse' && user.user_metadata?.role !== 'paramedic' && user.user_metadata?.role !== 'admin' && user.user_metadata?.role !== 'facility_manager')) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen bg-surface-sunken">
      {/* Sidebar for desktop */}
      <aside className="hidden w-64 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 items-center border-b border-border px-4">
          <h1 className="font-semibold text-foreground">Panel Personelu</h1>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <a href="/staff" className="block rounded-md bg-accent-soft px-3 py-2 text-sm font-medium text-accent-foreground">
            Pensjonariusze
          </a>
          <a href="/reports" className="block rounded-md px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-sunken hover:text-foreground">
            Raporty
          </a>
        </nav>
        <div className="p-4 border-t border-border">
           <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm font-medium text-text-secondary hover:text-foreground">
              Wyloguj ({user.email})
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <header className="flex h-14 items-center border-b border-border bg-surface px-4 md:hidden justify-between">
          <h1 className="font-semibold text-foreground">Panel Personelu</h1>
           <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm font-medium text-text-secondary hover:text-foreground">
              Wyloguj
            </button>
          </form>
        </header>
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
