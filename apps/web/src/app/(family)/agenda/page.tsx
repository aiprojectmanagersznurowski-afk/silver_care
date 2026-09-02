import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function FamilyAgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/')

  // Read linked residents
  const { data: links } = await supabase
    .from('resident_relative_links')
    .select('resident_id, residents(id, first_name, last_name)')
    .eq('relative_user_id', user.id)

  const residents = (links || []).map(link => 
    Array.isArray(link.residents) ? link.residents[0] : link.residents
  ).filter(Boolean) as { id: string; first_name: string; last_name: string }[]

  if (residents.length === 0) {
    return (
      <div className="text-center py-12">Brak powiązanych pensjonariuszy.</div>
    )
  }

  const cookieStore = await cookies()
  const cookieResidentId = cookieStore.get('family_resident_id')?.value
  const activeResident = residents.find(r => r.id === cookieResidentId) || residents[0]

  // Fetch agenda items (facility-wide OR resident-specific)
  const { data: agendaItems } = await supabase
    .from('agenda_items')
    .select('*')
    .or(`resident_id.is.null,resident_id.eq.${activeResident.id}`)
    .order('time', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Plan Dnia — {activeResident.first_name} {activeResident.last_name}
        </h2>
        <p className="text-text-secondary">Przewidywany harmonogram dnia w placówce.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dzisiejszy harmonogram</CardTitle>
          <CardDescription>Oto, jak zazwyczaj wygląda dzień Twojego bliskiego.</CardDescription>
        </CardHeader>
        <CardContent>
          {!agendaItems || agendaItems.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              Brak zaplanowanych wydarzeń na dziś.
            </div>
          ) : (
            <div className="space-y-4">
              {agendaItems.map((item: any) => (
                <div key={item.id} className="flex border-b border-border pb-4 last:border-0 last:pb-0">
                  <div className="w-20 font-semibold text-text-secondary">
                    {item.time.substring(0, 5)}
                  </div>
                  <div>
                    <div className="font-medium">{item.title}</div>
                    {item.resident_id && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded mt-1 inline-block">
                        Indywidualne
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
