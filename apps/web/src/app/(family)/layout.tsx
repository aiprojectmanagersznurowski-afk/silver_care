import { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function FamilyLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.user_metadata?.role !== 'family') {
    // Teoretycznie middleware już to zabezpiecza, ale dla pewności rzutujemy.
    redirect('/')
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-sunken">
      {/* Mobile-first top navigation / header */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Silver Care
          </h1>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm font-medium text-text-secondary hover:text-foreground">
              Wyloguj
            </button>
          </form>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl">
          {children}
        </div>
      </main>
    </div>
  )
}
