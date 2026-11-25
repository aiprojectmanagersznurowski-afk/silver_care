import { redirect } from 'next/navigation'
import { OPERATIONAL_REPORT_ENGINE } from '@silvercare/contracts/src/generated/voice'
import { Button } from '@/components/ui/button'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import { ListEmpty, ListError } from '@/components/patterns/ListState'
import { PageHeader } from '@/components/patterns/PageHeader'
import { OrganizationReportConfigsPanel } from '@/components/reports/OrganizationReportConfigsPanel'
import { getAppRole } from '@/lib/auth/app-role'
import { getCurrentFeatureFlags, isOrgFeatureEnabled } from '@/lib/feature-flags'
import { getActiveImpersonation, safeGetCookieStore } from '@/lib/impersonation-guards'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { createClient } from '@/lib/supabase/server'

export default async function AdminReportsPage({ searchParams }: {
  searchParams: Promise<{ organizationId?: string }>
}) {
  const user = await getCurrentUser()
  const role = getAppRole(user)
  if (!user || (role !== 'super_admin' && role !== 'org_admin')) redirect('/')

  const isPlatformAdmin = role === 'super_admin' && !getActiveImpersonation(await safeGetCookieStore(), user)
  let panel
  if (isPlatformAdmin) {
    const supabase = await createClient()
    const { data: organizations, error } = await supabase.from('organizations').select('id, name').order('name')
    const { organizationId } = await searchParams
    const selected = organizations?.find((org) => org.id === organizationId) ?? organizations?.[0]
    panel = error ? <ListError /> : selected ? (
      <>
        <form className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            Placówka
            <select name="organizationId" defaultValue={selected.id} className="min-h-touch rounded-md border bg-background px-3">
              {organizations?.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          </label>
          <Button type="submit" variant="outline">Pokaż kategorie</Button>
        </form>
        {await isOrgFeatureEnabled(supabase, selected.id, OPERATIONAL_REPORT_ENGINE.moduleKey)
          ? <OrganizationReportConfigsPanel key={selected.id} organizationId={selected.id} editMode="platform" />
          : <FeatureDisabledState />}
      </>
    ) : <ListEmpty title="Brak placówek" />
  } else {
    const context = await getCurrentFeatureFlags()
    panel = !context?.flags[OPERATIONAL_REPORT_ENGINE.moduleKey] ? <FeatureDisabledState />
      : role === 'super_admin' || user.app_metadata?.impersonator_id
        ? <ListEmpty title="Tryb podglądu" description="Konfiguracja kategorii jest dostępna po zakończeniu podglądu." />
        : <OrganizationReportConfigsPanel organizationId={context.organizationId}
            editMode={context.flags[OPERATIONAL_REPORT_ENGINE.delegationFlagKey] ? 'delegated' : 'read-only'} />
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Konfiguracja raportów operacyjnych" />
      {panel}
    </div>
  )
}
