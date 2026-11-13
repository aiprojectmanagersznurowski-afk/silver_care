import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { AgendaTimelineClient } from '@/components/AgendaTimelineClient'
import { PageHeader } from '@/components/patterns/PageHeader'
import { formatPersonName } from '@/lib/person-name'
import { isMedicalAgendaItem } from '@/lib/agenda-family-visibility'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { evaluateFamilyOffboardingState } from '@/lib/family-offboarding'

type AgendaResident = {
  id: string
  first_name: string
  last_name: string
  death_date?: string | null
  contract_end_date?: string | null
  archived_at?: string | null
}

export default async function FamilyAgendaPage(props: { searchParams: Promise<{ date?: string }> }) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return redirect('/')

  // 1. Pobieramy podopiecznych przez wąskie RPC dla rodziny (ochrona danych po wygaśnięciu)
  const { data: rpcResidents, error: rpcError } = await supabase.rpc('get_family_resident_overview')
  let residents: AgendaResident[] = (rpcResidents || []) as AgendaResident[]

  // 2. Bezpieczny fallback do resident_relative_links
  if (rpcError || residents.length === 0) {
    const { data: links } = await supabase
      .from('resident_relative_links')
      .select('resident_id, residents(id, first_name, last_name, death_date, contract_end_date, archived_at)')
      .eq('relative_user_id', user.id)

    residents = (links || [])
      .map(link => Array.isArray(link.residents) ? link.residents[0] : link.residents)
      .filter(Boolean) as AgendaResident[]
  }

  if (residents.length === 0) {
    return (
      <Card className="max-w-md mx-auto my-12 text-center">
        <CardContent className="py-12 space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-surface-sunken flex items-center justify-center">
            <CalendarDays className="size-6 text-primary" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Brak powiązanych podopiecznych</h3>
          <p className="text-sm text-text-secondary max-w-xs mx-auto">
            Twoje konto nie ma jeszcze przypisanego podopiecznego w placówce. Skontaktuj się z personelem, aby aktywować powiązanie.
          </p>
        </CardContent>
      </Card>
    )
  }

  const cookieStore = await cookies()
  const cookieResidentId = cookieStore.get('family_resident_id')?.value
  const activeResident = residents.find(r => r.id === cookieResidentId) || residents[0]

  if (evaluateFamilyOffboardingState(activeResident).mode !== 'active') {
    return redirect('/dashboard')
  }

  const resolvedParams = await Promise.resolve(props.searchParams)
  const dateParam = typeof resolvedParams.date === 'string' ? resolvedParams.date : undefined
  const viewDateStr = dateParam || new Date().toISOString().slice(0, 10)

  const viewDateObj = new Date(viewDateStr)
  const prevDate = new Date(viewDateObj)
  prevDate.setDate(prevDate.getDate() - 1)
  const nextDate = new Date(viewDateObj)
  nextDate.setDate(nextDate.getDate() + 1)

  const prevDateStr = prevDate.toISOString().slice(0, 10)
  const nextDateStr = nextDate.toISOString().slice(0, 10)
  const todayStr = new Date().toISOString().slice(0, 10)

  const { data: allItems } = await supabase
    .from('agenda_items')
    .select('id, title, time, type, resident_id, target_date')
    .or(`resident_id.is.null,resident_id.eq.${activeResident.id}`)
    .order('time', { ascending: true })

  // Bez treści medycznych (FAM-AGENDA-NO-MEDICAL); twarda granica to RLS rodziny (family_visible)
  const agendaItems = (allItems || []).filter(item =>
    (item.target_date === null || item.target_date === viewDateStr) && !isMedicalAgendaItem(item)
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Plan dnia — ${formatPersonName(activeResident.first_name, activeResident.last_name)}`}
        description="Harmonogram aktywności, posiłków i wydarzeń w placówce."
      />

      <div className="flex items-center justify-between bg-card border border-border p-2 rounded-lg">
        <Link href={`/agenda?date=${prevDateStr}`}>
          <Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="text-center font-medium">
          {new Date(viewDateStr).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
          {viewDateStr === todayStr && <span className="ml-2 text-sm bg-primary/10 text-primary px-2 py-0.5 rounded-full">Dziś</span>}
        </div>
        <Link href={`/agenda?date=${nextDateStr}`}>
          <Button variant="ghost" size="icon"><ChevronRight className="h-5 w-5" /></Button>
        </Link>
      </div>

      <AgendaTimelineClient items={agendaItems} viewDateStr={viewDateStr} />
    </div>
  )
}
