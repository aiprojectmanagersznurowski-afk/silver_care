import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isImpersonationSessionActive } from '@/lib/impersonation-guards'
import { getResidentCard } from '@/lib/resident-card/get-resident-card'
import { ResidentCard } from '@/components/residents/card/ResidentCard'
import { ListError } from '@/components/patterns/ListState'

/** Karta podopiecznego w części personelu — ta sama karta co u kierownika, sekcje według roli (SC-ADM-20). */
export default async function StaffResidentCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isImpersonating = isImpersonationSessionActive(await cookies(), user)
  const card = await getResidentCard(supabase, id, user, isImpersonating)

  if (card.status === 'forbidden') redirect('/')
  if (card.status === 'not_found') notFound()
  if (card.status === 'error') {
    return <ListError description="Nie udało się wczytać karty podopiecznego. Odśwież stronę albo spróbuj później." />
  }

  return (
    <ResidentCard
      card={card}
      backHref="/staff"
      backLabel="Wróć do tablicy dyżuru"
      reportsHref={`/staff/reports?resident=${id}`}
    />
  )
}
