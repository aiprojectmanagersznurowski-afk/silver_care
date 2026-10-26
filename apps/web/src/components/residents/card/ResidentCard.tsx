import { differenceInDays, differenceInYears } from 'date-fns'
import { RESIDENT_CARD_SECTIONS } from '@silvercare/contracts/src/generated/presentation'
import type { ResidentCardResult } from '@/lib/resident-card/get-resident-card'
import { PolarWearableCard } from '@/components/PolarWearableCard'
import type {
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
import { ResidentProfileTabs, type ProfileTab } from '@/components/residents/profile/ResidentProfileTabs'
import { WellnessSection } from './WellnessSection'
import { DailySection } from './DailySection'

type OkCard = Extract<ResidentCardResult, { status: 'ok' }>

interface ResidentCardProps {
  card: OkCard
  backHref: string
  backLabel: string
  /** Pełna lista raportów w części aplikacji właściwej dla roli. */
  reportsHref: string
}

const labelOf = (id: string) => RESIDENT_CARD_SECTIONS.find((s) => s.id === id)?.label ?? id
const list = <T,>(value: unknown) => (Array.isArray(value) ? (value as T[]) : [])

/**
 * Wspólna karta podopiecznego dla personelu (SC-ADM-20). Zakładki i sekcje wynikają wyłącznie z listy
 * sekcji roli (RESIDENT_CARD_SECTIONS); dane pochodzą z getResidentCard, które pobiera tylko to, co rola może czytać.
 */
export function ResidentCard({ card, backHref, backLabel, reportsHref }: ResidentCardProps) {
  const has = (id: string) => (card.sections as readonly string[]).includes(id)
  const resident = card.resident as unknown as FullResidentData

  const age = resident.birth_date ? differenceInYears(new Date(), new Date(resident.birth_date)) : null
  const stayDays = resident.admission_date ? differenceInDays(new Date(), new Date(resident.admission_date)) : null
  const isActive = !resident.archived_at && !resident.death_date &&
    (!resident.contract_end_date || new Date(resident.contract_end_date) > new Date())

  const assignments = list<ResidentBedAssignment>(resident.bed_assignments)
  const activeAssignment = assignments.find((a) => a.unassigned_at === null) ?? null
  const pastAssignments = assignments
    .filter((a) => a.unassigned_at !== null)
    .sort((a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime())
  const events = [...list<ResidentEventItem>(resident.resident_events)].sort(
    (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  )
  const activePackages = list<ResidentPackageItem>(resident.resident_packages).filter((p) => !p.ended_at)
  const relativeLinks = list<ResidentRelativeLinkItem>(resident.resident_relative_links)

  const tabs: ProfileTab[] = []
  if (has('wellness')) tabs.push({ id: 'wellness', label: labelOf('wellness'), content: <WellnessSection /> })
  if (has('daily')) {
    tabs.push({
      id: 'daily',
      label: labelOf('daily'),
      content: <DailySection reports={card.daily?.reports ?? []} agenda={card.daily?.agenda ?? []} reportsHref={reportsHref} />,
    })
  }
  if (has('family')) tabs.push({ id: 'family', label: labelOf('family'), content: <ResidentFamilyCard resident={resident} relativeLinks={relativeLinks} /> })
  if (has('events')) tabs.push({ id: 'events', label: labelOf('events'), content: <ResidentEventsCard events={events} /> })
  if (has('wearable')) {
    const link = card.wearable as { external_user_id?: string; created_at?: string } | null
    tabs.push({
      id: 'wearable',
      label: labelOf('wearable'),
      content: (
        <PolarWearableCard
          residentId={resident.id}
          initialLinked={Boolean(link)}
          externalUserId={link?.external_user_id}
          linkedAt={link?.created_at}
        />
      ),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <ResidentProfileHeader
        resident={resident}
        isActive={isActive}
        canManage={has('manage')}
        backHref={backHref}
        backLabel={backLabel}
        activeAssignment={activeAssignment}
      />
      <ResidentProfileTabs
        overviewLabel={labelOf('overview')}
        overview={
          <>
            <ResidentGeneralInfoCard resident={resident} age={age} stayDays={stayDays} />
            {has('bed') && <ResidentBedInfoCard activeAssignment={activeAssignment} pastAssignments={pastAssignments} />}
          </>
        }
        sidebar={has('contract') ? <ResidentContractCard resident={resident} activePackages={activePackages} /> : undefined}
        tabs={tabs}
      />
    </div>
  )
}
