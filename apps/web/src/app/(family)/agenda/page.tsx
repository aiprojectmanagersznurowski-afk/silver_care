import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function FamilyAgendaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Plan Dnia
        </h2>
        <p className="text-text-secondary">Przewidywany harmonogram dnia w placówce.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dzisiejszy harmonogram</CardTitle>
          <CardDescription>Oto, jak zazwyczaj wygląda dzień Twojego bliskiego.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex border-b border-border pb-4">
              <div className="w-20 font-semibold text-text-secondary">08:00</div>
              <div>Śniadanie i poranna toaleta</div>
            </div>
            <div className="flex border-b border-border pb-4">
              <div className="w-20 font-semibold text-text-secondary">10:00</div>
              <div>Zajęcia rehabilitacyjne i fizjoterapia</div>
            </div>
            <div className="flex border-b border-border pb-4">
              <div className="w-20 font-semibold text-text-secondary">13:00</div>
              <div>Obiad i czas na drzemkę</div>
            </div>
            <div className="flex border-b border-border pb-4">
              <div className="w-20 font-semibold text-text-secondary">15:30</div>
              <div>Podwieczorek i zajęcia grupowe</div>
            </div>
            <div className="flex">
              <div className="w-20 font-semibold text-text-secondary">18:00</div>
              <div>Kolacja i przygotowanie do snu</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
