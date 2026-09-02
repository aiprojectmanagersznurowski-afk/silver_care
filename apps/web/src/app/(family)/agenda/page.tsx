import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AgendaTimelineClient } from '@/components/AgendaTimelineClient'

export default async function FamilyAgendaPage(props: { searchParams: Promise<{ date?: string }> | { date?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
      <div className="text-center py-12">Brak powiązanych pensjonariuszy.</div>
    )
  }

  const cookieStore = await cookies()
  const cookieResidentId = cookieStore.get('family_resident_id')?.value
  const activeResident = residents.find(r => r.id === cookieResidentId) || residents[0]

  // Resolve searchParams (Next.js 15 compatible)
  const resolvedParams = await Promise.resolve(props.searchParams)
  const dateParam = typeof resolvedParams.date === 'string' ? resolvedParams.date : undefined
  const viewDateStr = dateParam || new Date().toISOString().slice(0, 10)
  
  // Calculate prev/next days
  const viewDateObj = new Date(viewDateStr)
  const prevDate = new Date(viewDateObj)
  prevDate.setDate(prevDate.getDate() - 1)
  const nextDate = new Date(viewDateObj)
  nextDate.setDate(nextDate.getDate() + 1)

  const prevDateStr = prevDate.toISOString().slice(0, 10)
  const nextDateStr = nextDate.toISOString().slice(0, 10)
  const todayStr = new Date().toISOString().slice(0, 10)

  // Fetch agenda items (facility-wide OR resident-specific) AND (recurring OR specific date)
  // We need to use nested ORs or just fetch all for resident/null and then filter in memory if PostgREST doesn't support complex AND/OR.
  // Actually, we can just fetch items where resident matches, and then filter by date in JS to be safe.
  const { data: allItems } = await supabase
    .from('agenda_items')
    .select('*')
    .or(`resident_id.is.null,resident_id.eq.${activeResident.id}`)
    .order('time', { ascending: true })

  const agendaItems = (allItems || []).filter(item => 
    item.target_date === null || item.target_date === viewDateStr
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Plan Dnia — {activeResident.first_name} {activeResident.last_name}
        </h2>
        <p className="text-text-secondary">Przewidywany harmonogram w placówce.</p>
      </div>

      <div className="flex items-center justify-between bg-card border border-border p-2 rounded-lg">
        <Link href={`/agenda?date=${prevDateStr}`}>
          <Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="text-center font-medium">
          {new Date(viewDateStr).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
          {viewDateStr === todayStr && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Dziś</span>}
        </div>
        <Link href={`/agenda?date=${nextDateStr}`}>
          <Button variant="ghost" size="icon"><ChevronRight className="h-5 w-5" /></Button>
        </Link>
      </div>

      <AgendaTimelineClient items={agendaItems} viewDateStr={viewDateStr} />
    </div>
  )
}
