export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { BusinessIdBadge } from '@/components/BusinessIdBadge'
import { EditOrganizationDialog } from '@/components/EditOrganizationDialog'
import { OrganizationKpiCards } from '@/components/organizations/OrganizationKpiCards'
import { OrganizationAdminsSection } from '@/components/organizations/OrganizationAdminsSection'
import { OrganizationStaffSection } from '@/components/organizations/OrganizationStaffSection'
import { PageHeader } from '@/components/patterns/PageHeader'
import { getAppRole, getAppOrganizationId } from '@/lib/auth/app-role'
import { getCurrentUser } from '@/lib/supabase/current-user'

export default async function OrganizationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const role = getAppRole(user)
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

  // 2. Pobierz liczbę podopiecznych (agregacja COUNT — zero PII)
  const adminClient = createAdminClient()
  const { count: activeResidentCount } = await adminClient
    .from('residents')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', id)
    .is('archived_at', null)

  // 3. Pobierz konta powiązane z tą organizacją
  const { data: usersData } = await adminClient.auth.admin.listUsers()

  const orgUsers = (usersData?.users || []).filter(u =>
    getAppOrganizationId(u) === id
  )

  const administrators = orgUsers.filter(u =>
    getAppRole(u) === 'org_admin'
  )

  const staff = orgUsers.filter(u =>
    getAppRole(u) !== 'org_admin'
  )

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: '/admin/organizations', label: 'Wróć do listy placówek' }}
        title={organization.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            <span>{organization.address || 'Brak adresu'}</span>
            <BusinessIdBadge type="organization" id={organization.id} />
          </span>
        }
        actions={
          <EditOrganizationDialog
            organization={{
              organization_id: organization.id,
              organization_name: organization.name,
              address: organization.address,
              resident_limit: organization.resident_limit || 50,
            }}
          />
        }
      />

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
