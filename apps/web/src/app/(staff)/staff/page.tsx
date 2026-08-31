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
        <p className="text-text-secondary">Wybierz podopiecznego, aby nagrać notatkę głosową.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {residents?.map((resident) => (
          <Card key={resident.id} className="group hover:border-primary/40 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                  {resident.first_name?.[0]}{resident.last_name?.[0]}
                </span>
                {resident.first_name} {resident.last_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <a href={`/voice?resident=${resident.id}`} className="block w-full">
                <Button className="w-full" variant="outline">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" x2="12" y1="19" y2="22"/>
                  </svg>
                  Nagranie głosowe
                </Button>
              </a>
            </CardContent>
          </Card>
        ))}
        {(!residents || residents.length === 0) && (
          <div className="col-span-full py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" x2="19" y1="8" y2="14"/>
                <line x1="22" x2="16" y1="11" y2="11"/>
              </svg>
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">Brak pensjonariuszy</h3>
            <p className="text-sm text-text-secondary">
              Poproś administratora placówki o dodanie podopiecznych do systemu.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
