import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users, Bed, BedDouble, ShieldAlert, CheckCircle2, Building2 } from 'lucide-react'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = user?.app_metadata?.role || user?.user_metadata?.role
  const cookieStore = await cookies()
  const isImpersonating = !!cookieStore.get('sc_impersonation')?.value

  // Super Admin bez aktywnej sesji impersonacji zarządza platformą (placówki)
  if (role === 'super_admin' && !isImpersonating) {
    redirect('/admin/organizations')
  }
  
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
        <h2 className="text-3xl font-display font-semibold tracking-tight text-foreground">
          Pulpit Główny
        </h2>
        <p className="mt-2 text-muted-foreground">Szybki podgląd stanu placówki i obłożenia.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Residents */}
        <Card className="rounded-xl border-none ring-1 ring-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aktywni podopieczni</p>
                <h3 className="text-2xl font-bold text-foreground">{residentsCount || 0}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Occupancy Rate */}
        <Card className="rounded-xl border-none ring-1 ring-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground">
                <Bed className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Obłożenie placówki</p>
                <h3 className="text-2xl font-bold text-foreground">{occupancyRate}%</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Free Beds */}
        <Card className="rounded-xl border-none ring-1 ring-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground">
                <BedDouble className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Wolne łóżka</p>
                <h3 className="text-2xl font-bold text-foreground">{(totalBedsCount || 0) - (occupiedBedsCount || 0)}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: System Status */}
        <Card className="rounded-xl border-none ring-1 ring-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status systemu</p>
                <h3 className="text-lg font-bold text-foreground">Stabilny</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="rounded-xl border-none ring-1 ring-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Na skróty</CardTitle>
            <CardDescription>Szybki dostęp do kluczowych sekcji</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
             <Link href="/admin/residents" className="flex flex-col items-center justify-center p-6 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-foreground font-medium text-sm gap-3">
               <Users className="h-8 w-8 text-primary" />
               Lista podopiecznych
             </Link>
             <Link href="/admin/facility" className="flex flex-col items-center justify-center p-6 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-foreground font-medium text-sm gap-3">
               <Building2 className="h-8 w-8 text-primary" />
               Struktura ośrodka
             </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
