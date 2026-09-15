import { createClient } from '@/lib/supabase/server'
import { ReportCard } from '@/components/ReportCard'
import { BulkReportApprover } from '@/components/BulkReportApprover'
import Link from 'next/link'
import { ArrowLeft, Mic, FileText } from 'lucide-react'

interface StaffReportsPageProps {
  searchParams: Promise<{ resident?: string }>
}

export default async function StaffReportsPage({ searchParams }: StaffReportsPageProps) {
  const { resident: residentId } = await searchParams
  const supabase = await createClient()

  let residentInfo: { first_name: string; last_name: string } | null = null

  if (residentId) {
    const { data: res } = await supabase
      .from('residents')
      .select('first_name, last_name')
      .eq('id', residentId)
      .single()
    if (res) {
      residentInfo = res
    }
  }

  // Budujemy zapytanie o raporty
  let query = supabase
    .from('daily_reports')
    .select(`
      *,
      residents (
        id,
        first_name,
        last_name
      )
    `)
    .order('created_at', { ascending: false })

  if (residentId) {
    // Jeśli wybrano konkretnego podopiecznego, pokazujemy wszystkie jego raporty (DRAFT i PUBLISHED)
    query = query.eq('resident_id', residentId)
  } else {
    // Jeśli nie wybrano podopiecznego, domyślnie pokazujemy szkice do zatwierdzenia
    query = query.eq('status', 'DRAFT')
  }

  const { data: reports } = await query
  const draftReports = (reports || []).filter((r) => r.status === 'DRAFT')

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link 
              href="/staff" 
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-soft hover:text-slate transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Wróć do listy podopiecznych
            </Link>
          </div>
          <h2 className="text-2xl font-display font-semibold tracking-tight text-slate">
            {residentInfo 
              ? `Raporty: ${residentInfo.first_name} ${residentInfo.last_name}`
              : 'Raporty do weryfikacji'
            }
          </h2>
          <p className="text-sm text-slate-soft">
            {residentInfo 
              ? 'Historia oraz bieżące szkice raportów wygenerowane dla tego podopiecznego.'
              : 'Zatwierdź szkice raportów wygenerowane przez AI, aby rodzina mogła je zobaczyć.'
            }
          </p>
        </div>

        {residentId && (
          <div className="flex items-center gap-2">
            <Link href={`/voice?resident=${residentId}`}>
              <button className="inline-flex items-center gap-2 rounded-xl bg-sage px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sage-dark transition-colors">
                <Mic className="h-4 w-4" />
                Nagraj nową notatkę
              </button>
            </Link>
          </div>
        )}
      </div>

      {draftReports.length > 0 && (
        <BulkReportApprover draftReports={draftReports} />
      )}

      <div className="grid gap-4">
        {reports && reports.length > 0 ? (
          reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))
        ) : (
          <div className="py-16 text-center rounded-2xl border border-dashed border-slate/20 bg-slate/5">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sage/10 text-sage-dark mb-4">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-medium text-slate mb-1">
              {residentInfo 
                ? 'Brak raportów dla tego podopiecznego' 
                : 'Brak raportów oczekujących na weryfikację'}
            </h3>
            <p className="text-sm text-slate-soft max-w-sm mx-auto">
              {residentInfo 
                ? 'Nie utworzono jeszcze raportu dla tej osoby. Możesz nagrać notatkę głosową, aby AI wygenerowało szkic.'
                : 'Wszystkie wygenerowane notatki zostały już zweryfikowane lub nie utworzono nowych szkiców.'}
            </p>
            {residentId && (
              <div className="mt-6">
                <Link href={`/voice?resident=${residentId}`}>
                  <button className="inline-flex items-center gap-2 rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sage-dark transition-colors">
                    <Mic className="h-4 w-4" />
                    Nagraj notatkę głosową
                  </button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
