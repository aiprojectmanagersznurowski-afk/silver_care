'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Calendar, LogOut } from 'lucide-react'

export function StaffSidebar({ userEmail }: { userEmail: string | undefined }) {
  const pathname = usePathname()

  const navItems = [
    { name: 'Podopieczni', href: '/staff', icon: Users },
    { name: 'Plan Dnia', href: '/staff/agenda', icon: Calendar },
  ]

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-slate/10 bg-cream px-6 pb-4">
        <div className="flex h-16 shrink-0 items-center">
          <span className="text-xl font-display font-semibold text-slate tracking-tight">Silver Care</span>
          <span className="ml-2 rounded-full bg-sage/20 px-2.5 py-0.5 text-xs font-medium text-sage-dark">Personel</span>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`
                          group flex gap-x-3 rounded-xl p-3 text-sm leading-6 font-medium transition-all
                          ${isActive
                            ? 'bg-sage/10 text-sage-dark'
                            : 'text-slate-soft hover:bg-slate/5 hover:text-slate'
                          }
                        `}
                      >
                        <item.icon
                          className={`h-5 w-5 shrink-0 ${isActive ? 'text-sage-dark' : 'text-slate-soft group-hover:text-slate'}`}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
            
            <li className="mt-auto -mx-2">
              <div className="px-3 py-3 mb-2 rounded-xl bg-slate/5">
                <p className="text-xs font-medium text-slate-soft truncate">
                  Zalogowano jako:
                </p>
                <p className="text-sm font-medium text-slate truncate">
                  {userEmail || 'Nieznany użytkownik'}
                </p>
              </div>
              
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="group flex w-full gap-x-3 rounded-xl p-3 text-sm leading-6 font-medium text-slate-soft transition-all hover:bg-slate/5 hover:text-slate"
                >
                  <LogOut className="h-5 w-5 shrink-0 text-slate-soft group-hover:text-slate" aria-hidden="true" />
                  Wyloguj
                </button>
              </form>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
