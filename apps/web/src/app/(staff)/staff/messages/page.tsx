import { requireOrgFeature } from '@/lib/feature-flags'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/current-user'

export const dynamic = 'force-dynamic'

export default async function StaffMessagesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ residentId?: string }>
}) {
  if (!(await requireOrgFeature('module_family_portal')).allowed) return <FeatureDisabledState />

  const user = await getCurrentUser()

  if (!user) {
    redirect('/')
  }

  const role = user.app_metadata?.role
  if (role === 'org_admin') {
    const params = await searchParams
    const suffix = params?.residentId ? `?residentId=${encodeURIComponent(params.residentId)}` : ''
    redirect(`/admin/messages${suffix}`)
  }

  redirect('/unauthorized')
}
