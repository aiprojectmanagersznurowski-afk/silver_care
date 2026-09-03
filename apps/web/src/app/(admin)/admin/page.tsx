import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users, Bed, BedDouble, ShieldAlert, CheckCircle2, Building2 } from 'lucide-react'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()
  
  // 1. Get total residents
  const { count: residentsCount } = await supabase
    .from('residents')
    .select('*', { count: 'exact', head: true })
    .is('archived_at', null)

  // 2. Get total beds
  const { count: totalBedsCount } = await supabase
    .from('beds')
    .select('*', { count: 'exact', head: true })

  // 3. Get occupied beds
  const { count: occupiedBedsCount } = await supabase
    .from('bed_assignments')
    .select('*', { count: 'exact', head: true })
    .is('unassigned_at', null)

  // 4. Get total staff
  const { data: { users } } = await supabase.auth.admin.listUsers() // Need org context or similar
  
  const occupancyRate = totalBedsCount ? Math.round(((occupiedBedsCount || 0) / totalBedsCount) * 100) : 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-display font-semibold tracking-tight text-slate">
          Pulpit Główny
        </h2>
        <p className="mt-2 text-slate-soft">Szybki podgląd stanu placówki i obłożenia.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Residents */}
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sage/10 text-sage">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-soft">Aktywni podopieczni</p>
                <h3 className="text-2xl font-bold text-slate">{residentsCount || 0}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Occupancy Rate */}
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Bed className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-soft">Obłożenie placówki</p>
                <h3 className="text-2xl font-bold text-slate">{occupancyRate}%</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Free Beds */}
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <BedDouble className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-soft">Wolne łóżka</p>
                <h3 className="text-2xl font-bold text-slate">{(totalBedsCount || 0) - (occupiedBedsCount || 0)}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: System Status */}
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-200">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-soft">Status systemu</p>
                <h3 className="text-lg font-bold text-slate">Stabilny</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate/5">
          <CardHeader>
            <CardTitle className="text-lg text-slate">Na skróty</CardTitle>
            <CardDescription>Szybki dostęp do kluczowych sekcji</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
             <Link href="/admin/residents" className="flex flex-col items-center justify-center p-6 rounded-xl bg-slate/5 hover:bg-slate/10 transition-colors text-slate font-medium text-sm gap-3">
               <Users className="h-8 w-8 text-sage" />
               Lista podopiecznych
             </Link>
             <Link href="/admin/facility" className="flex flex-col items-center justify-center p-6 rounded-xl bg-slate/5 hover:bg-slate/10 transition-colors text-slate font-medium text-sm gap-3">
               <Building2 className="h-8 w-8 text-sage" />
               Struktura ośrodka
             </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
