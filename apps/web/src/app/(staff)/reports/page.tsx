import { createClient } from '@/lib/supabase/server'
import { ReportCard } from '@/components/ReportCard'

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
          <ReportCard key={report.id} report={report} />
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
