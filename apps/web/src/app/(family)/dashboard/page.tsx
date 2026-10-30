import { createClient } from '@/lib/supabase/server'
import { FamilyDashboardClient } from '@/components/FamilyDashboardClient'
import { FamilyOffboardingView } from '@/components/family/FamilyOffboardingView'
import { evaluateFamilyOffboardingState } from '@/lib/family-offboarding'
import { cookies } from 'next/headers'
import { mergeAndSortAgenda, AgendaItem } from '@/lib/agenda'
import { Users } from 'lucide-react'
import { isMedicalAgendaItem } from '@/lib/agenda-family-visibility'
import { getCurrentUser } from '@/lib/supabase/current-user'

type ResidentType = {
  id: string
  first_name: string
  last_name: string
  death_date?: string | null
  contract_end_date?: string | null
  archived_at?: string | null
  death_reported_at?: string | null
};

export default async function FamilyDashboard(props: { searchParams: Promise<{ date?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) return null

  // Pobieramy powiązanych podopiecznych
  const { data: links } = await supabase
    .from('resident_relative_links')
    .select(`
      resident_id,
      residents (
        id,
        first_name,
        last_name,
        death_date,
        contract_end_date,
        archived_at,
        death_reported_at
      )`)
    .eq('relative_user_id', user.id)

  const residents: ResidentType[] = (links || []).map(link => 
    Array.isArray(link.residents) ? link.residents[0] : link.residents
  ).filter(Boolean) as unknown as ResidentType[]

  if (residents.length === 0) {
    return (
      <div className="mx-auto my-12 max-w-lg rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-primary">
          <Users className="size-7" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-foreground font-display">Brak powiązanych podopiecznych</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Twoje konto nie zostało jeszcze przypisane do profilu podopiecznego w placówce.
          Skontaktuj się z administracją placówki, aby aktywować dostęp do raportów.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <form action="/auth/signout" method="post" className="w-full sm:w-auto">
            <button
              type="submit"
              className="w-full min-h-touch rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Wyloguj się
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Odczyt wybranego podopiecznego z ciasteczka (ustawianego przez GlobalResidentSwitcher)
  const cookieStore = await cookies()
  const cookieResidentId = cookieStore.get('family_resident_id')?.value
  const activeResident = residents.find(r => r.id === cookieResidentId) || residents[0]

  const offboardingState = evaluateFamilyOffboardingState(activeResident)
  if (offboardingState.mode === 'retention_expired') {
    return (
      <FamilyOffboardingView
        resident={activeResident}
        state={offboardingState}
        reports={[]}
      />
    )
  }

  // Pobieramy raporty tylko dla wybranego pensjonariusza
  const { data: reports } = await supabase
    .from('daily_reports')
    .select('id, resident_id, created_at, content')
    .eq('resident_id', activeResident.id)
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false })

  type Report = {
    id: string
    resident_id: string
    created_at: string
    content: {
      text?: string
      metrics?: {
        steps?: number
        sleep_hours?: number
      }
    }
  }

  if (offboardingState.mode === 'memorial_window') {
    return (
      <FamilyOffboardingView
        resident={activeResident}
        state={offboardingState}
        reports={(reports || []) as Report[]}
      />
    )
  }

  // Pobieramy zdjęcia pensjonariusza z wybranego dnia
  const selectedDate = searchParams?.date || new Date().toISOString().split('T')[0]
  const { data: media } = await supabase
    .from('resident_media')
    .select('storage_path')
    .eq('resident_id', activeResident.id)
    .eq('captured_at', selectedDate)
    .order('created_at', { ascending: false })

  const signedUrls = await Promise.all(
    (media || []).map(async (m) => {
      const { data } = await supabase.storage.from('resident-media').createSignedUrl(m.storage_path, 3600)
      return data?.signedUrl
    })
  )

  // Fetch agenda
  const { data: agendaData } = await supabase
    .from('agenda_items')
    .select('id, title, time, type, resident_id')
    .or(`resident_id.eq.${activeResident.id},resident_id.is.null`)

  const common: AgendaItem[] = []
  const individual: AgendaItem[] = []
  
  // Bez treści medycznych (FAM-AGENDA-NO-MEDICAL); twarda granica to RLS rodziny (family_visible)
  ;(agendaData || []).filter((item) => !isMedicalAgendaItem(item)).forEach(item => {
    if (item.resident_id === null) {
      common.push(item as AgendaItem)
    } else {
      individual.push(item as AgendaItem)
    }
  })
  
  const sortedAgenda = mergeAndSortAgenda(common, individual)

  return (
    <FamilyDashboardClient
      resident={activeResident}
      reports={(reports || []) as Report[]}
      selectedDateMedia={signedUrls.filter(Boolean) as string[]}
      agenda={sortedAgenda}
      selectedDate={selectedDate}
    />
  )
}
