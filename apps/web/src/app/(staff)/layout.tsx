export const dynamic = 'force-dynamic'
import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Users, Calendar, FileText, LogOut } from 'lucide-react'

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.user_metadata?.role || user?.app_metadata?.role
  if (!user || (role !== 'nurse' && role !== 'paramedic' && role !== 'admin' && role !== 'org_admin' && role !== 'facility_manager')) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen bg-surface-sunken">
      {/* Sidebar for desktop */}
      <aside className="hidden w-64 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 items-center border-b border-border px-4">
          <h1 className="font-semibold text-foreground">Panel Personelu</h1>
        </div>
        <nav className="flex-1 space-y-2 p-4">
          <a href="/staff" className="flex items-center gap-3 rounded-md bg-accent-soft px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-soft/80">
            <Users className="h-4 w-4" />
            Pensjonariusze
          </a>
          <a href="/staff/agenda" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-sunken hover:text-foreground">
            <Calendar className="h-4 w-4" />
            Plan dnia
          </a>
          <a href="/reports" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-sunken hover:text-foreground">
            <FileText className="h-4 w-4" />
            Raporty
          </a>
        </nav>
        <div className="p-4 border-t border-border">
           <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" className="w-full justify-start gap-3 text-text-secondary hover:text-foreground">
              <LogOut className="h-4 w-4" />
              Wyloguj ({user.email})
            </Button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <header className="flex h-14 items-center border-b border-border bg-surface px-4 md:hidden justify-between">
          <h1 className="font-semibold text-foreground">Panel Personelu</h1>
           <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm" className="gap-2 text-text-secondary hover:text-foreground">
              <LogOut className="h-4 w-4" />
              Wyloguj
            </Button>
          </form>
        </header>
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
