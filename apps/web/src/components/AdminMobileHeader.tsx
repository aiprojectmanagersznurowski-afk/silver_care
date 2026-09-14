'use client'

import { LogOut, Menu, ChevronDown, CalendarDays, BarChart3, TrendingUp, Building2, Users, UserPlus, Mail, ShieldAlert, ShieldCheck, LayoutDashboard } from 'lucide-react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

export function AdminMobileHeader({ 
  userEmail, 
  role, 
  isImpersonating = false 
}: { 
  userEmail: string 
  role?: string 
  isImpersonating?: boolean 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const isAnalysisActive = pathname.startsWith('/admin/reports')
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(isAnalysisActive)

  useEffect(() => {
    if (isAnalysisActive) {
      setIsAnalysisOpen(true)
    }
  }, [isAnalysisActive])

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b border-slate/10 bg-white px-4 md:hidden">
        <div className="flex items-center gap-2">
          <Link href="/admin" className="flex items-center hover:opacity-90 transition-opacity">
            <Image
              src="/logo.png"
              alt="Silver Care"
              width={110}
              height={32}
              className="h-7 w-auto object-contain"
              priority
            />
          </Link>
          <span className="rounded-md bg-sage/10 px-1.5 py-0.5 text-[0.65rem] font-medium text-sage uppercase tracking-wider">
            {role === 'super_admin' ? 'Super Admin' : 'Admin'}
          </span>
        </div>
        <div className="flex items-center gap-4">
           <form action="/auth/signout" method="post">
            <button type="submit" className="text-slate-soft hover:text-slate">
              <LogOut className="h-5 w-5" />
            </button>
          </form>
          <button onClick={() => setIsOpen(!isOpen)} className="text-slate">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>
      {isOpen && (
        <div className="absolute inset-x-0 top-16 z-50 border-b border-slate/10 bg-white shadow-lg md:hidden max-h-[85vh] overflow-y-auto">
          <nav className="flex flex-col p-4 space-y-3">
            {/* Nawigacja platformowa Super Admina */}
            {role === 'super_admin' && !isImpersonating && (
              <div className="space-y-1.5">
                <div className="px-3 pb-1 text-[0.65rem] font-semibold tracking-wider text-slate-soft/70 uppercase">
                  Zarządzanie Platformą
                </div>
                <Link
                  href="/admin/organizations"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    pathname.startsWith('/admin/organizations') ? 'bg-sage text-white' : 'text-slate hover:bg-slate/5'
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  Placówki
                </Link>
                <Link
                  href="/admin/iam"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    pathname.startsWith('/admin/iam') ? 'bg-sage text-white' : 'text-slate hover:bg-slate/5'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Uprawnienia (IAM)
                </Link>
                <Link
                  href="/admin/audit"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    pathname.startsWith('/admin/audit') ? 'bg-sage text-white' : 'text-slate hover:bg-slate/5'
                  }`}
                >
                  <ShieldAlert className="h-4 w-4" />
                  Rejestr Audytowy
                </Link>
              </div>
            )}

            {/* Nawigacja placówkowa (operacyjna) */}
            {(role !== 'super_admin' || isImpersonating) && (
              <div className="space-y-1.5">
                {isImpersonating && (
                  <div className="px-3 pb-1 text-[0.65rem] font-semibold tracking-wider text-amber-600 uppercase">
                    Operacje Placówki (Podgląd)
                  </div>
                )}
                <Link
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    pathname === '/admin' ? 'bg-sage text-white' : 'text-slate hover:bg-slate/5'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Pulpit Placówki
                </Link>
                <Link
                  href="/admin/facility"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    pathname.startsWith('/admin/facility') ? 'bg-sage text-white' : 'text-slate hover:bg-slate/5'
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  Struktura Placówki
                </Link>
                <Link
                  href="/admin/residents"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    pathname.startsWith('/admin/residents') ? 'bg-sage text-white' : 'text-slate hover:bg-slate/5'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  Podopieczni
                </Link>
                <Link
                  href="/admin/staff"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    pathname.startsWith('/admin/staff') ? 'bg-sage text-white' : 'text-slate hover:bg-slate/5'
                  }`}
                >
                  <UserPlus className="h-4 w-4" />
                  Personel
                </Link>
                <Link
                  href="/admin/invitations"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    pathname.startsWith('/admin/invitations') ? 'bg-sage text-white' : 'text-slate hover:bg-slate/5'
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  Zaproszenia
                </Link>

                {/* Rozwijane menu Analiza */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setIsAnalysisOpen((prev) => !prev)}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                      isAnalysisActive && !isAnalysisOpen
                        ? 'bg-sage/10 text-sage font-semibold'
                        : isAnalysisActive
                        ? 'text-slate font-semibold bg-slate/5'
                        : 'text-slate hover:bg-slate/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <TrendingUp className={`h-4 w-4 ${isAnalysisActive ? 'text-sage' : 'text-slate-soft'}`} />
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
                      <Link
                        href="/admin/reports/daily"
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          pathname === '/admin/reports/daily'
                            ? 'bg-sage text-white'
                            : 'text-slate-soft hover:bg-slate/5 hover:text-slate'
                        }`}
                      >
                        <CalendarDays className="h-4 w-4" />
                        Dane Dzienne
                      </Link>
                      <Link
                        href="/admin/reports/statistics"
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          pathname === '/admin/reports/statistics'
                            ? 'bg-sage text-white'
                            : 'text-slate-soft hover:bg-slate/5 hover:text-slate'
                        }`}
                      >
                        <BarChart3 className="h-4 w-4" />
                        Statystyka
                      </Link>
                    </div>
                  )}
                </div>

                <Link
                  href="/admin/audit"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    pathname.startsWith('/admin/audit') ? 'bg-sage text-white' : 'text-slate hover:bg-slate/5'
                  }`}
                >
                  <ShieldAlert className="h-4 w-4" />
                  Rejestr Audytowy
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  )
}
