import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { bed_id, resident_id } = body

    if (!bed_id || !resident_id) {
      return NextResponse.json({ error: 'Brak wymaganych danych (bed_id, resident_id)' }, { status: 400 })
    }

    const { error: unassignError } = await supabase
      .from('bed_assignments')
      .update({ unassigned_at: new Date().toISOString() })
      .eq('bed_id', bed_id)
      .eq('resident_id', resident_id)
      .is('unassigned_at', null)

    if (unassignError) {
      console.error('Failed to unassign bed:', unassignError)
      return NextResponse.json({ error: 'Błąd podczas usuwania przypisania: ' + unassignError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Wystąpił nieoczekiwany błąd serwera' }, { status: 500 })
  }
}
