import { MetricCard, MetricGrid } from '@/components/patterns/MetricCard'
import { Users, UserCog, UserCheck } from 'lucide-react'

interface OrganizationKpiCardsProps {
  activeResidentCount: number
  residentLimit: number
  administratorsCount: number
  staffCount: number
}

export function OrganizationKpiCards({
  activeResidentCount,
  residentLimit,
  administratorsCount,
  staffCount
}: OrganizationKpiCardsProps) {
  return (
    <MetricGrid>
      <MetricCard icon={<Users />} label="Aktywni podopieczni" value={activeResidentCount} description={`Limit placówki: ${residentLimit}`} />
      <MetricCard icon={<UserCog />} label="Kierownicy placówki" value={administratorsCount} />
      <MetricCard icon={<UserCheck />} label="Personel opiekuńczy" value={staffCount} />
    </MetricGrid>
  )
}
