'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { 
  Users, 
  UserPlus, 
  Building2, 
  ShieldAlert, 
  LogOut, 
  LayoutDashboard, 
  ShieldCheck, 
  Mail, 
  CalendarDays, 
  BarChart3,
  TrendingUp,
  ChevronDown
} from 'lucide-react'

export function AdminSidebar({ userEmail, role }: { userEmail: string; role?: string }) {
  const pathname = usePathname()
  const isAnalysisActive = pathname.startsWith('/admin/reports')
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(isAnalysisActive)

  useEffect(() => {
    if (isAnalysisActive) {
      setIsAnalysisOpen(true)
    }
  }, [isAnalysisActive])

  const topLinks = [
    { href: '/admin', label: 'Pulpit', icon: LayoutDashboard },
    { href: '/admin/facility', label: 'Struktura Placówki', icon: Building2 },
    { href: '/admin/residents', label: 'Podopieczni', icon: Users },
    { href: '/admin/staff', label: 'Personel', icon: UserPlus },
    { href: '/admin/invitations', label: 'Zaproszenia', icon: Mail },
  ]

  const analysisSubLinks = [
    { href: '/admin/reports/daily', label: 'Dane Dzienne', icon: CalendarDays },
    { href: '/admin/reports/statistics', label: 'Statystyka', icon: BarChart3 },
  ]

  const bottomLinks = [
    { href: '/admin/audit', label: 'Rejestr Audytowy', icon: ShieldAlert },
    ...(role === 'super_admin' ? [{ href: '/admin/iam', label: 'Uprawnienia (IAM)', icon: ShieldCheck }] : []),
  ]

  return (
    <aside className="hidden w-72 flex-col border-r border-slate/10 bg-white md:flex">
      <div className="flex h-20 items-center justify-between border-b border-slate/10 px-6">
        <Link href="/admin" className="flex items-center hover:opacity-90 transition-opacity">
          <Image
            src="/logo.png"
            alt="Silver Care"
            width={130}
            height={38}
            className="h-8 w-auto object-contain"
            priority
          />
        </Link>
        <span className="rounded-md bg-sage/10 px-2 py-1 text-xs font-medium text-sage">
          {role === 'super_admin' ? 'Super Admin' : 'Admin'}
        </span>
      </div>
      <nav className="flex-1 space-y-1.5 p-4 overflow-y-auto">
        {topLinks.map((link) => {
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

        {/* Rozwijane menu Analiza */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setIsAnalysisOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-[0.95rem] font-medium transition-colors ${
              isAnalysisActive && !isAnalysisOpen
                ? 'bg-sage/10 text-sage font-semibold'
                : isAnalysisActive
                ? 'text-slate font-semibold bg-slate/5'
                : 'text-slate-soft hover:bg-slate/5 hover:text-slate'
            }`}
          >
            <div className="flex items-center gap-3">
              <TrendingUp className={`h-5 w-5 ${isAnalysisActive ? 'text-sage' : 'text-slate-soft'}`} />
              <span>Analiza</span>
            </div>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                isAnalysisOpen ? 'rotate-180 text-slate' : 'text-slate-soft'
              }`}
            />
          </button>

          {isAnalysisOpen && (
            <div className="ml-4 space-y-1 border-l-2 border-slate/10 pl-3 pt-1">
              {analysisSubLinks.map((subLink) => {
                const SubIcon = subLink.icon
                const isSubActive = pathname === subLink.href || pathname.startsWith(subLink.href)

                return (
                  <Link
                    key={subLink.href}
                    href={subLink.href}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isSubActive
                        ? 'bg-sage text-white shadow-sm'
                        : 'text-slate-soft hover:bg-slate/5 hover:text-slate'
                    }`}
                  >
                    <SubIcon className={`h-4 w-4 ${isSubActive ? 'text-white' : 'text-slate-soft'}`} />
                    {subLink.label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {bottomLinks.map((link) => {
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
