export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, ArrowLeft, MapPin } from 'lucide-react'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { EditOrganizationDialog } from '@/components/EditOrganizationDialog'
import { OrganizationKpiCards } from '@/components/organizations/OrganizationKpiCards'
import { OrganizationAdminsSection } from '@/components/organizations/OrganizationAdminsSection'
import { OrganizationStaffSection } from '@/components/organizations/OrganizationStaffSection'

export default async function OrganizationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = user?.app_metadata?.role || user?.user_metadata?.role
  if (role !== 'super_admin') {
    redirect('/admin')
  }

  // 1. Pobierz placówkę
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single()

  if (orgError || !organization) {
    notFound()
  }

  // 2. Pobierz liczbę pensjonariuszy (agregacja COUNT — zero PII)
  const adminClient = createAdminClient()
  const { count: activeResidentCount } = await adminClient
    .from('residents')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', id)
    .is('archived_at', null)

  // 3. Pobierz konta powiązane z tą organizacją
  const { data: usersData } = await adminClient.auth.admin.listUsers()

  const orgUsers = (usersData?.users || []).filter(u =>
    u.app_metadata?.organization_id === id || u.user_metadata?.organization_id === id
  )

  const administrators = orgUsers.filter(u =>
    u.app_metadata?.role === 'org_admin' || u.user_metadata?.role === 'org_admin'
  )

  const staff = orgUsers.filter(u =>
    u.app_metadata?.role !== 'org_admin' && u.user_metadata?.role !== 'org_admin'
  )

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/organizations"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Wróć do listy placówek
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-3xl font-display font-semibold tracking-tight text-foreground">
                  {organization.name}
                </h2>
                <BusinessIdBadge type="organization" id={organization.id} />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <MapPin className="h-4 w-4" />
                <span>{organization.address || 'Brak adresu'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <EditOrganizationDialog
              organization={{
                organization_id: organization.id,
                organization_name: organization.name,
                address: organization.address,
                resident_limit: organization.resident_limit || 50,
              }}
            />
          </div>
        </div>
      </div>

      {/* Karty KPI placówki */}
      <OrganizationKpiCards
        activeResidentCount={activeResidentCount || 0}
        residentLimit={organization.resident_limit || 50}
        administratorsCount={administrators.length}
        staffCount={staff.length}
      />

      {/* Identyfikatory kont w sekcjach potomnych:
          <BusinessIdBadge type="user" id={admin.id} />
          <BusinessIdBadge type="user" id={person.id} /> */}

      {/* Sekcja Administratorzy */}
      <OrganizationAdminsSection
        organizationId={organization.id}
        organizationName={organization.name}
        administrators={administrators}
      />

      {/* Sekcja Personel */}
      <OrganizationStaffSection staff={staff} />
    </div>
  )
}
