export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrganizationsManagementClient, OrganizationSummaryItem } from '@/components/OrganizationsManagementClient'
import { CreateOrganizationDialog } from '@/components/CreateOrganizationDialog'
import { PageHeader } from '@/components/patterns/PageHeader'
import { getAppRole } from '@/lib/auth/app-role'

export default async function OrganizationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = getAppRole(user)

  // AC1: Dostęp wyłącznie dla konta o roli super_admin
  if (role !== 'super_admin') {
    redirect('/admin')
  }

interface SuperadminOrgSummaryRow {
  organization_id: string
  organization_name: string
  address?: string | null
  resident_limit?: number | string | null
  created_at: string
  active_resident_count?: number | string | null
  staff_count?: number | string | null
  administrator_count?: number | string | null
}

  let organizations: OrganizationSummaryItem[] = []
  let errorMessage: string | undefined

  try {
    const { data, error } = await supabase.rpc('get_superadmin_organization_summary')
    if (error) {
      console.error('Błąd pobierania podsumowania placówek:', error)
      errorMessage = error.message
    } else {
      organizations = ((data as SuperadminOrgSummaryRow[]) || []).map((row) => ({
        organization_id: row.organization_id,
        organization_name: row.organization_name,
        address: row.address,
        resident_limit: Number(row.resident_limit || 50),
        created_at: row.created_at,
        active_resident_count: Number(row.active_resident_count || 0),
        staff_count: Number(row.staff_count || 0),
        administrator_count: Number(row.administrator_count || 0)
      }))
    }
  } catch (err: unknown) {
    errorMessage = err instanceof Error ? err.message : 'Nieoczekiwany błąd serwera'
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Zarządzanie Placówkami"
        description="Rejestr ośrodków, monitorowanie wykorzystania limitów oraz zarządzanie infrastrukturą platformy."
        actions={<CreateOrganizationDialog />}
      />

      <OrganizationsManagementClient
        initialOrganizations={organizations}
        errorMessage={errorMessage}
      />
    </div>
  )
}
