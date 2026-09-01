import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { FamilyMessageForm } from '@/components/FamilyMessageForm'

type ResidentType = { id: string; first_name: string; last_name: string };

export default async function FamilyDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Pobieramy powiązanych pensjonariuszy
  const { data: links } = await supabase
    .from('resident_relative_links')
    .select(`
      resident_id,
      residents (
        id,
        first_name,
        last_name
      )`)
    .eq('relative_user_id', user.id)

  const residents: ResidentType[] = (links || []).map(link => 
    Array.isArray(link.residents) ? link.residents[0] : link.residents
  ).filter(Boolean) as unknown as ResidentType[]

  if (residents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center">
        <h2 className="text-xl font-semibold">Brak powiązanych pensjonariuszy</h2>
        <p className="text-text-secondary">
          Skontaktuj się z administracją placówki, aby uzyskać dostęp do informacji o Twoim bliskim.
        </p>
      </div>
    )
  }

  // Pobieramy raporty dla wszystkich
  const residentIds = residents.map(r => r.id)
  
  const { data: reports } = await supabase
    .from('daily_reports')
    .select('*')
    .in('resident_id', residentIds)
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-12">
      {residents.map(resident => {
        const latestReport = reports?.find(r => r.resident_id === resident.id)

        return (
          <div key={resident.id} className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {resident.first_name} {resident.last_name}
              </h2>
              <p className="text-text-secondary">Najnowsze informacje z placówki</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {latestReport ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Raport z dnia</CardTitle>
                    <CardDescription>
                      {format(new Date(latestReport.created_at), "d MMMM yyyy", { locale: pl })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="prose prose-sm dark:prose-invert">
                      <p className="whitespace-pre-wrap">{latestReport.content.text || 'Brak treści raportu.'}</p>
                    </div>
                    {latestReport.content.metrics && (
                      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                        {latestReport.content.metrics.steps && (
                          <div className="rounded-lg bg-surface-sunken p-3">
                            <div className="text-xs font-medium text-text-tertiary">Kroki</div>
                            <div className="mt-1 text-lg font-semibold">{latestReport.content.metrics.steps}</div>
                          </div>
                        )}
                        {latestReport.content.metrics.sleep_hours && (
                          <div className="rounded-lg bg-surface-sunken p-3">
                            <div className="text-xs font-medium text-text-tertiary">Sen</div>
                            <div className="mt-1 text-lg font-semibold">{latestReport.content.metrics.sleep_hours}h</div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-text-secondary">
                    Brak opublikowanych raportów na ten moment.
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Kontakt z administracją</CardTitle>
                  <CardDescription>
                    Zostaw wiadomość dla personelu (zostanie dostarczona do panelu głównego).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FamilyMessageForm residentId={resident.id} />
                </CardContent>
              </Card>
            </div>
          </div>
        )
      })}
    </div>
  )
}
