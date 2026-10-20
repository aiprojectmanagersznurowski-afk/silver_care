/**
 * Strona profilu podopiecznego — integruje:
 * - EditResidentDialog (w sekcji nagłówka profilu podopiecznego)
 * - InviteFamilyDialog z triggerLabel="Zaproś bliskiego" (w sekcji bliskich i kontaktów)
 */

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { differenceInYears, differenceInDays } from 'date-fns'
import { PolarWearableCard } from '@/components/PolarWearableCard'
import { isImpersonationSessionActive } from '@/lib/impersonation-guards'
import {
  FullResidentData,
  ResidentBedAssignment,
  ResidentEventItem,
  ResidentPackageItem,
  ResidentRelativeLinkItem,
} from '@/components/residents/profile/profile-types'
import { ResidentProfileHeader } from '@/components/residents/profile/ResidentProfileHeader'
import { ResidentGeneralInfoCard } from '@/components/residents/profile/ResidentGeneralInfoCard'
import { ResidentBedInfoCard } from '@/components/residents/profile/ResidentBedInfoCard'
import { ResidentFamilyCard } from '@/components/residents/profile/ResidentFamilyCard'
import { ResidentContractCard } from '@/components/residents/profile/ResidentContractCard'
import { ResidentEventsCard } from '@/components/residents/profile/ResidentEventsCard'

export default async function ResidentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const cookieStore = await cookies()
  const isImpersonating = isImpersonationSessionActive(cookieStore, user)

  // Pobierz podopiecznego wraz ze wszystkimi relacjami
  const { data: rawResident, error } = await supabase
    .from('residents')
    .select(`
      *,
      bed_assignments(id, assigned_at, unassigned_at, beds(id, label, rooms(number, floor, sector))),
      resident_relative_links(id, relative_user_id, relationship_code, role, is_primary_contact, created_at),
      resident_events(id, event_type, event_date, event_reason, metadata, created_at),
      resident_packages(id, package_type, package_name, monthly_rate, started_at, ended_at)
    `)
    .eq('id', id)
    .single()

  // Pobierz status urządzenia Polar
  const { data: polarLink } = await supabase
    .from('external_wearable_links')
    .select('id, provider, external_user_id, created_at')
    .eq('resident_id', id)
    .eq('provider', 'POLAR')
    .maybeSingle()

  if (error || !rawResident) {
    notFound()
  }

  const resident = rawResident as unknown as FullResidentData

  const age = resident.birth_date
    ? differenceInYears(new Date(), new Date(resident.birth_date))
    : null

  const stayDays = resident.admission_date
    ? differenceInDays(new Date(), new Date(resident.admission_date))
    : null

  const isActive = !resident.archived_at && !resident.death_date &&
    (!resident.contract_end_date || new Date(resident.contract_end_date) > new Date())

  const activeAssignment = Array.isArray(resident.bed_assignments)
    ? (resident.bed_assignments as ResidentBedAssignment[]).find((a) => a.unassigned_at === null)
    : null

  const pastAssignments = Array.isArray(resident.bed_assignments)
    ? (resident.bed_assignments as ResidentBedAssignment[])
        .filter((a) => a.unassigned_at !== null)
        .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime())
    : []

  const sortedEvents = Array.isArray(resident.resident_events)
    ? [...(resident.resident_events as ResidentEventItem[])].sort(
        (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
      )
    : []

  const activePackages = Array.isArray(resident.resident_packages)
    ? (resident.resident_packages as ResidentPackageItem[]).filter((p) => !p.ended_at)
    : []

  const relativeLinks = Array.isArray(resident.resident_relative_links)
    ? (resident.resident_relative_links as ResidentRelativeLinkItem[])
    : []

  return (
    <div className="space-y-8">
      <ResidentProfileHeader
        resident={resident}
        isActive={isActive}
        isImpersonating={isImpersonating}
        activeAssignment={activeAssignment}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <ResidentGeneralInfoCard
            resident={resident}
            age={age}
            stayDays={stayDays}
          />
          <ResidentBedInfoCard
            activeAssignment={activeAssignment}
            pastAssignments={pastAssignments}
          />
          <ResidentEventsCard events={sortedEvents} />
        </div>

        <div className="space-y-6">
          <ResidentFamilyCard
            resident={resident}
            relativeLinks={relativeLinks}
          />
          <PolarWearableCard
            residentId={resident.id}
            initialLinked={Boolean(polarLink)}
            externalUserId={polarLink?.external_user_id}
            linkedAt={polarLink?.created_at}
          />
          <ResidentContractCard
            resident={resident}
            activePackages={activePackages}
          />
        </div>
      </div>
    </div>
  )
}
