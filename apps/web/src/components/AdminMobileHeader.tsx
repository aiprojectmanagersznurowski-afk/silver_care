'use client'

import { LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'

export function AdminMobileHeader({ userEmail }: { userEmail: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b border-slate/10 bg-white px-4 md:hidden">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-xl font-semibold text-slate">Silver Care</h1>
          <span className="rounded-md bg-sage/10 px-1.5 py-0.5 text-[0.65rem] font-medium text-sage uppercase tracking-wider">Admin</span>
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
        <div className="absolute inset-x-0 top-16 z-50 border-b border-slate/10 bg-white shadow-lg md:hidden">
          <nav className="flex flex-col p-4 space-y-2">
            <Link href="/admin" onClick={() => setIsOpen(false)} className="rounded-xl px-4 py-3 text-sm font-medium text-slate hover:bg-slate/5">Pulpit</Link>
            <Link href="/admin/residents" onClick={() => setIsOpen(false)} className="rounded-xl px-4 py-3 text-sm font-medium text-slate hover:bg-slate/5">Podopieczni</Link>
            <Link href="/admin/staff" onClick={() => setIsOpen(false)} className="rounded-xl px-4 py-3 text-sm font-medium text-slate hover:bg-slate/5">Personel</Link>
            <Link href="/admin/facility" onClick={() => setIsOpen(false)} className="rounded-xl px-4 py-3 text-sm font-medium text-slate hover:bg-slate/5">Struktura Placówki</Link>
            <Link href="/admin/audit" onClick={() => setIsOpen(false)} className="rounded-xl px-4 py-3 text-sm font-medium text-slate hover:bg-slate/5">Rejestr Audytowy</Link>
          </nav>
        </div>
      )}
    </>
  )
}
