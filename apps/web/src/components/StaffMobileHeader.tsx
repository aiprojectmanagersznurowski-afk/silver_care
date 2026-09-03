'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Users, Calendar, LogOut } from 'lucide-react'

export function StaffMobileHeader({ userEmail }: { userEmail: string | undefined }) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const navItems = [
    { name: 'Podopieczni', href: '/staff', icon: Users },
    { name: 'Plan Dnia', href: '/staff/agenda', icon: Calendar },
  ]

  return (
    <div className="lg:hidden sticky top-0 z-40 bg-cream/80 backdrop-blur-md border-b border-slate/10">
      <div className="flex items-center justify-between px-4 h-16">
        <div className="flex items-center">
          <span className="text-xl font-display font-semibold text-slate tracking-tight">Silver Care</span>
          <span className="ml-2 rounded-full bg-sage/20 px-2 py-0.5 text-[10px] font-medium text-sage-dark uppercase tracking-wider">
            Personel
          </span>
        </div>
        
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-slate-soft hover:text-slate"
        >
          <span className="sr-only">Otwórz menu</span>
          {isOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="absolute inset-x-0 top-16 bg-cream border-b border-slate/10 shadow-lg px-4 py-6">
          <nav className="flex flex-col gap-y-6">
            <ul role="list" className="-mx-2 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`
                        group flex gap-x-3 rounded-xl p-3 text-base leading-6 font-medium transition-all
                        ${isActive
                          ? 'bg-sage/10 text-sage-dark'
                          : 'text-slate-soft hover:bg-slate/5 hover:text-slate'
                        }
                      `}
                    >
                      <item.icon
                        className={`h-5 w-5 shrink-0 ${isActive ? 'text-sage-dark' : 'text-slate-soft'}`}
                        aria-hidden="true"
                      />
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="pt-4 border-t border-slate/10">
              <div className="px-2 pb-4">
                <p className="text-xs font-medium text-slate-soft">Zalogowano jako:</p>
                <p className="text-sm font-medium text-slate truncate">{userEmail || 'Nieznany użytkownik'}</p>
              </div>
              <form action="/auth/signout" method="post" className="-mx-2">
                <button
                  type="submit"
                  className="group flex w-full gap-x-3 rounded-xl p-3 text-base leading-6 font-medium text-slate-soft transition-all hover:bg-slate/5 hover:text-slate"
                >
                  <LogOut className="h-5 w-5 shrink-0 text-slate-soft group-hover:text-slate" aria-hidden="true" />
                  Wyloguj się
                </button>
              </form>
            </div>
          </nav>
        </div>
      )}
    </div>
  )
}
