import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function StaffReportsPage() {
  const supabase = await createClient()

  // Pobieramy raporty w statusie DRAFT z organizacji pielęgniarki
  const { data: drafts } = await supabase
    .from('daily_reports')
    .select(`
      *,
      residents (
        first_name,
        last_name
      )
    `)
    .eq('status', 'DRAFT')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Raporty do weryfikacji
        </h2>
        <p className="text-text-secondary">Zatwierdź szkice raportów wygenerowane przez AI, aby rodzina mogła je zobaczyć.</p>
      </div>

      <div className="grid gap-4">
        {drafts?.map((report) => (
          <Card key={report.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                Raport dla: {report.residents?.first_name} {report.residents?.last_name}
              </CardTitle>
              <CardDescription>
                Utworzono: {new Date(report.created_at).toLocaleDateString('pl-PL')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-surface-sunken rounded-md text-sm">
                {report.content.text || 'Brak wygenerowanego tekstu.'}
              </div>
              <div className="flex space-x-2">
                <Button className="w-full sm:w-auto" variant="default">Zatwierdź i publikuj</Button>
                <Button className="w-full sm:w-auto" variant="outline">Edytuj</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!drafts || drafts.length === 0) && (
          <div className="py-8 text-center text-text-secondary">
            Brak raportów oczekujących na weryfikację.
          </div>
        )}
      </div>
    </div>
  )
}
