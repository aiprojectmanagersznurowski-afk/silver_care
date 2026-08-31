import { Card, CardContent } from '@/components/ui/card'

export default function FamilyMessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Wiadomości
        </h2>
        <p className="text-text-secondary">Kontakt z personelem opiekuńczym.</p>
      </div>

      <Card>
        <CardContent className="py-12 text-center text-text-secondary">
          <p>Funkcja wiadomości będzie dostępna wkrótce.</p>
          <p className="text-sm mt-2">W pilnych przypadkach prosimy o kontakt telefoniczny z placówką.</p>
        </CardContent>
      </Card>
    </div>
  )
}
