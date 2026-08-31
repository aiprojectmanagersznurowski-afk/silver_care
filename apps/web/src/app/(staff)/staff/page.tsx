import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function StaffDashboard() {
  const supabase = await createClient()

  const { data: residents } = await supabase
    .from('residents')
    .select('*')
    .is('archived_at', null)
    .order('last_name', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Pensjonariusze
        </h2>
        <p className="text-text-secondary">Lista podopiecznych w placówce.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {residents?.map((resident) => (
          <Card key={resident.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                {resident.first_name} {resident.last_name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full mt-4" variant="outline">
                <a href={`/staff/voice?resident=${resident.id}`}>Nagranie głosowe (Groq)</a>
              </Button>
            </CardContent>
          </Card>
        ))}
        {(!residents || residents.length === 0) && (
          <div className="col-span-full py-8 text-center text-text-secondary">
            Brak pensjonariuszy w bazie.
          </div>
        )}
      </div>
    </div>
  )
}
