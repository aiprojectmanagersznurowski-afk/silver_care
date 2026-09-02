import { createClient } from '@/lib/supabase/server'
import { FamilyDashboardClient } from '@/components/FamilyDashboardClient'
import { cookies } from 'next/headers'

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

  // Odczyt wybranego podopiecznego z ciasteczka (ustawianego przez GlobalResidentSwitcher)
  const cookieStore = await cookies()
  const cookieResidentId = cookieStore.get('family_resident_id')?.value
  const activeResident = residents.find(r => r.id === cookieResidentId) || residents[0]

  // Pobieramy raporty tylko dla wybranego pensjonariusza
  const { data: reports } = await supabase
    .from('daily_reports')
    .select('*')
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

  return (
    <FamilyDashboardClient
      resident={activeResident}
      reports={(reports || []) as Report[]}
    />
  )
}
