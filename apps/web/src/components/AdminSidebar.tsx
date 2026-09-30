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

export function AdminSidebar({ 
  userEmail, 
  role, 
  isImpersonating = false 
}: { 
  userEmail: string 
  role?: string 
  isImpersonating?: boolean 
}) {
  const pathname = usePathname()
  const isAnalysisActive = pathname.startsWith('/admin/reports')
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(isAnalysisActive)

  useEffect(() => {
    if (isAnalysisActive) {
      setIsAnalysisOpen(true)
    }
  }, [isAnalysisActive])

  // Globalne linki dla Super Admina (zarządzanie całą platformą)
  const platformLinks = [
    { href: '/admin/organizations', label: 'Placówki', icon: Building2 },
    { href: '/admin/iam', label: 'Uprawnienia (IAM)', icon: ShieldCheck },
    { href: '/admin/audit', label: 'Rejestr Audytowy', icon: ShieldAlert },
  ]

  // Linki operacyjne w placówce (dla personelu/admina lub Super Admina w impersonacji)
  const facilityTopLinks = [
    { href: '/admin', label: 'Pulpit Placówki', icon: LayoutDashboard },
    { href: '/admin/facility', label: 'Struktura Placówki', icon: Building2 },
    { href: '/admin/residents', label: 'Podopieczni', icon: Users },
    { href: '/admin/staff', label: 'Personel', icon: UserPlus },
    { href: '/admin/invitations', label: 'Zaproszenia', icon: Mail },
  ]

  const analysisSubLinks = [
    { href: '/admin/reports/daily', label: 'Dane Dzienne', icon: CalendarDays },
    { href: '/admin/reports/statistics', label: 'Statystyka', icon: BarChart3 },
  ]

  const facilityBottomLinks = [
    { href: '/admin/audit', label: 'Rejestr Placówki', icon: ShieldAlert },
  ]

  return (
    <aside className="hidden w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
        <Link href="/admin" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Image
            src="/logo.png"
            alt="Silver Care"
            width={124}
            height={36}
            className="h-7 w-auto object-contain"
            priority
          />
        </Link>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {role === 'super_admin' ? 'Super Admin' : 'Admin'}
        </span>
      </div>

      <nav className="flex-1 space-y-4 p-3.5 overflow-y-auto">
        {/* Widok Platformowy Super Admina */}
        {role === 'super_admin' && !isImpersonating && (
          <div className="space-y-1">
            <div className="px-3 pb-1.5 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">
              Zarządzanie Platformą
            </div>
            {platformLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href))

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  {link.label}
                </Link>
              )
            })}
          </div>
        )}

        {/* Widok Operacyjny Placówki */}
        {(role !== 'super_admin' || isImpersonating) && (
          <div className="space-y-1">
            {isImpersonating && (
              <div className="px-3 pb-1.5 text-[0.7rem] font-semibold tracking-wider text-amber-600 uppercase">
                Operacje Placówki (Podgląd)
              </div>
            )}
            {facilityTopLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href))

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  {link.label}
                </Link>
              )
            })}

            {/* Rozwijane menu Analiza */}
            <div className="space-y-1 pt-1">
              <button
                type="button"
                onClick={() => setIsAnalysisOpen((prev) => !prev)}
                className={`flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
                  isAnalysisActive && !isAnalysisOpen
                    ? 'bg-primary/10 text-primary font-semibold'
                    : isAnalysisActive
                    ? 'text-foreground font-semibold bg-muted'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className={`h-4.5 w-4.5 ${isAnalysisActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span>Analiza</span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    isAnalysisOpen ? 'rotate-180 text-foreground' : 'text-muted-foreground'
                  }`}
                />
              </button>

              {isAnalysisOpen && (
                <div className="ml-4 space-y-1 border-l-2 border-border pl-3 pt-1">
                  {analysisSubLinks.map((subLink) => {
                    const SubIcon = subLink.icon
                    const isSubActive = pathname === subLink.href || pathname.startsWith(subLink.href)

                    return (
                      <Link
                        key={subLink.href}
                        href={subLink.href}
                        className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                          isSubActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        }`}
                      >
                        <SubIcon className={`h-4 w-4 ${isSubActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                        {subLink.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {facilityBottomLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href))

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  {link.label}
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      <div className="p-3.5 border-t border-sidebar-border bg-muted/40">
        <div className="mb-3 px-1 text-xs text-muted-foreground truncate">
          <span className="block text-[11px] uppercase tracking-wider text-muted-foreground/70">Zalogowano:</span>
          <span className="font-medium text-foreground truncate">{userEmail}</span>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Wyloguj się
          </button>
        </form>
      </div>
    </aside>
  )
}
