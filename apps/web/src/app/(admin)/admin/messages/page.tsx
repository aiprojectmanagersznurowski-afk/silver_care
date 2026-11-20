import { requireOrgFeature } from '@/lib/feature-flags'
import { FeatureDisabledState } from '@/components/patterns/FeatureDisabledState'
import { StaffMessagesInbox } from '@/components/StaffMessagesInbox'
import { PageHeader } from '@/components/patterns/PageHeader'

export const dynamic = 'force-dynamic'

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ residentId?: string }>
}) {
  if (!(await requireOrgFeature('module_family_portal')).allowed) return <FeatureDisabledState />

  const params = await searchParams

  return (
    <div className="flex flex-col h-[calc(100dvh-5rem)] md:h-[calc(100dvh-6rem)] gap-3 md:gap-4">
      <PageHeader
        className="shrink-0"
        title="Wiadomości"
        description="Bezpośredni kontakt kierownika placówki z rodzinami i opiekunami prawnymi podopiecznych."
      />

      <StaffMessagesInbox initialResidentId={params?.residentId} />
    </div>
  )
}
