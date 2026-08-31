import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

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

  type ResidentType = { id: string; first_name: string; last_name: string };
  const resident = Array.isArray(links?.[0]?.residents) 
    ? (links[0].residents[0] as unknown as ResidentType) 
    : (links?.[0]?.residents as unknown as ResidentType)

  if (!resident) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center">
        <h2 className="text-xl font-semibold">Brak powiązanych pensjonariuszy</h2>
        <p className="text-text-secondary">
          Skontaktuj się z administracją placówki, aby uzyskać dostęp do informacji o Twoim bliskim.
        </p>
      </div>
    )
  }

  // Pobieramy najnowszy raport
  const { data: reports } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('resident_id', resident.id)
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false })
    .limit(1)

  const latestReport = reports?.[0]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {resident.first_name} {resident.last_name}
        </h2>
        <p className="text-text-secondary">Najnowsze informacje z placówki</p>
      </div>

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
    </div>
  )
}
