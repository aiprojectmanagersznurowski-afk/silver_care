import { Card, CardContent } from '@/components/ui/card'
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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <Card className="rounded-xl border-none ring-1 ring-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Aktywni podopieczni</p>
              <div className="text-xl font-bold text-foreground">
                {activeResidentCount}
                <span className="text-sm font-normal text-muted-foreground"> / {residentLimit}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-none ring-1 ring-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Administratorzy placówki</p>
              <div className="text-xl font-bold text-foreground">
                {administratorsCount}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-none ring-1 ring-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Personel opiekuńczy</p>
              <div className="text-xl font-bold text-foreground">
                {staffCount}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
