import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { FamilyMessageForm } from '@/components/FamilyMessageForm'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/patterns/PageHeader'
import { formatPersonName } from '@/lib/person-name'
import { getCurrentUser } from '@/lib/supabase/current-user'

export default async function FamilyMessagesPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
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
      <div className="mx-auto my-12 max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <h3 className="text-lg font-semibold text-foreground font-display">Brak powiązanych podopiecznych</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Twoje konto nie ma jeszcze przypisanego podopiecznego. Skontaktuj się z personelem placówki.
        </p>
      </div>
    )
  }

  const cookieStore = await cookies()
  const cookieResidentId = cookieStore.get('family_resident_id')?.value
  const activeResident = residents.find(r => r.id === cookieResidentId) || residents[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Wiadomości — ${formatPersonName(activeResident.first_name, activeResident.last_name)}`}
        description="Kontakt z personelem opiekuńczym."
      />

      <div className="max-w-3xl mx-auto w-full">
        <FamilyMessageForm residentId={activeResident.id} />
      </div>
    </div>
  )
}
