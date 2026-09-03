'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, UserPlus, Building2, ShieldAlert, LogOut, LayoutDashboard } from 'lucide-react'

export function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()

  const links = [
    { href: '/admin', label: 'Pulpit', icon: LayoutDashboard },
    { href: '/admin/residents', label: 'Podopieczni', icon: Users },
    { href: '/admin/staff', label: 'Personel', icon: UserPlus },
    { href: '/admin/facility', label: 'Struktura Placówki', icon: Building2 },
    { href: '/admin/audit', label: 'Rejestr Audytowy', icon: ShieldAlert },
  ]

  return (
    <aside className="hidden w-72 flex-col border-r border-slate/10 bg-white md:flex">
      <div className="flex h-20 items-center border-b border-slate/10 px-6">
        <h1 className="font-display text-2xl font-semibold text-slate">Silver Care</h1>
        <span className="ml-2 rounded-md bg-sage/10 px-2 py-1 text-xs font-medium text-sage">Admin</span>
      </div>
      <nav className="flex-1 space-y-2 p-4">
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href))
          
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[0.95rem] font-medium transition-colors ${
                isActive 
                  ? 'bg-sage text-white shadow-sm' 
                  : 'text-slate-soft hover:bg-slate/5 hover:text-slate'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-slate-soft'}`} />
              {link.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-slate/10 bg-slate/5">
        <div className="mb-4 px-2 text-xs font-medium text-slate-soft truncate">
          Zalogowano jako:<br/>
          <span className="text-slate">{userEmail}</span>
        </div>
        <form action="/auth/signout" method="post">
          <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10">
            <LogOut className="h-4 w-4" />
            Wyloguj się
          </button>
        </form>
      </div>
    </aside>
  )
}
