import { isImpersonationSessionActive } from '@/lib/impersonation-guards'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { Users, Bed, BedDouble, FileText, Building2 } from 'lucide-react'
import { PageHeader } from '@/components/patterns/PageHeader'
import { MetricCard, MetricGrid } from '@/components/patterns/MetricCard'
import { getAppRole } from '@/lib/auth/app-role'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const role = getAppRole(user)
  const cookieStore = await cookies()
  const isImpersonating = isImpersonationSessionActive(cookieStore, user)

  // Super Admin bez aktywnej sesji impersonacji zarządza platformą (placówki)
  if (role === 'super_admin' && !isImpersonating) {
    redirect('/admin/organizations')
  }

  const [{ count: residentsCount }, { count: totalBedsCount }, { count: occupiedBedsCount }, { count: pendingReportsCount }] = await Promise.all([
    supabase.from('residents').select('*', { count: 'exact', head: true }).is('archived_at', null),
    supabase.from('beds').select('*', { count: 'exact', head: true }),
    supabase.from('bed_assignments').select('*', { count: 'exact', head: true }).is('unassigned_at', null),
    supabase.from('daily_reports').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
  ])

  const totalBeds = totalBedsCount || 0
  const occupiedBeds = occupiedBedsCount || 0
  const occupancyRate = totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader title="Pulpit Główny" description="Szybki podgląd stanu placówki i obłożenia." />

      <MetricGrid>
        <MetricCard icon={<Users />} label="Aktywni podopieczni" value={residentsCount || 0} description="Podopieczni bez archiwizacji." />
        <MetricCard icon={<Bed />} label="Obłożenie placówki" value={`${occupancyRate}%`} description={`${occupiedBeds} z ${totalBeds} łóżek zajętych.`} />
        <MetricCard icon={<BedDouble />} label="Wolne łóżka" value={totalBeds - occupiedBeds} description="Łóżka bez aktywnego przypisania." />
        <MetricCard icon={<FileText />} label="Raporty do zatwierdzenia" value={pendingReportsCount || 0} description="Raporty do zatwierdzenia w statusie roboczym." />
      </MetricGrid>

      <Card>
        <CardHeader>
          <CardTitle>Na skróty</CardTitle>
          <CardDescription>Szybki dostęp do kluczowych sekcji</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/admin/residents" className={buttonVariants({ variant: 'outline' })}>
            <Users />
            Lista podopiecznych
          </Link>
          <Link href="/admin/facility" className={buttonVariants({ variant: 'outline' })}>
            <Building2 />
            Struktura ośrodka
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
