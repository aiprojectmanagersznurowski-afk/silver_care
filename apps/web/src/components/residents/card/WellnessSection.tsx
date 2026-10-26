import { Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ListEmpty } from '@/components/patterns/ListState'

/**
 * Aktywność i sen (metryki behawioralne, SC-ADM-20). Dane z opaski nie trafiają jeszcze do bazy
 * (brak tabeli wellness_daily), więc sekcja mówi wprost, że danych nie ma — bez zmyślonych wartości.
 */
export function WellnessSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktywność i sen</CardTitle>
      </CardHeader>
      <CardContent>
        <ListEmpty
          icon={<Activity />}
          title="Brak danych o aktywności i śnie"
          description="Dane z opaski nie są jeszcze dostępne w systemie."
        />
      </CardContent>
    </Card>
  )
}
