export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrganizationsManagementClient, OrganizationSummaryItem } from '@/components/OrganizationsManagementClient'
import { CreateOrganizationDialog } from '@/components/CreateOrganizationDialog'

export default async function OrganizationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = user?.app_metadata?.role || user?.user_metadata?.role

  // AC1: Dostęp wyłącznie dla konta o roli super_admin
  if (role !== 'super_admin') {
    redirect('/admin')
  }

  let organizations: OrganizationSummaryItem[] = []
  let errorMessage: string | undefined

  try {
    const { data, error } = await supabase.rpc('get_superadmin_organization_summary')
    if (error) {
      console.error('Błąd pobierania podsumowania placówek:', error)
      errorMessage = error.message
    } else {
      organizations = (data || []).map((row: any) => ({
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-semibold tracking-tight text-slate">
            Zarządzanie Placówkami
          </h2>
          <p className="mt-2 text-slate-soft">
            Rejestr ośrodków, monitorowanie wykorzystania limitów oraz zarządzanie infrastrukturą platformy.
          </p>
        </div>
        <CreateOrganizationDialog />
      </div>

      <OrganizationsManagementClient
        initialOrganizations={organizations}
        errorMessage={errorMessage}
      />
    </div>
  )
}
