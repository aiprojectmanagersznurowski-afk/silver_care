import { requireOrgFeature } from '@/lib/feature-flags'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import { redirect } from 'next/navigation'

interface ReportsPageProps {
  searchParams: Promise<{ resident?: string }>
}

export default async function ReportsRedirectPage({ searchParams }: ReportsPageProps) {
  if (!(await requireOrgFeature('module_voice_and_reports')).allowed) return <FeatureDisabledState />

  const { resident } = await searchParams
  const query = resident ? `?resident=${encodeURIComponent(resident)}` : ''
  redirect(`/staff/reports${query}`)
}

