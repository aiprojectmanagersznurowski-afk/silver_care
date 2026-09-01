import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')

    const supabase = await createClient()
    let query = supabase.from('beds').select(`
      id, room_id, label, is_active, created_at,
      assignments:bed_assignments(id, assigned_at, unassigned_at, resident_id, residents(first_name, last_name, pesel_hash))
    `).order('label', { ascending: true })
    
    if (roomId) {
      query = query.eq('room_id', roomId)
    }

    const { data: beds, error } = await query

    if (error) {
      console.error('Failed to fetch beds:', error)
      return NextResponse.json({ error: 'Nie udało się pobrać łóżek' }, { status: 500 })
    }

    // Filter out historical assignments (we only care about active ones)
    const formattedBeds = beds?.map(bed => {
      const activeAssignment = bed.assignments?.find((a: any) => !a.unassigned_at)
      return {
        id: bed.id,
        room_id: bed.room_id,
        label: bed.label,
        is_active: bed.is_active,
        created_at: bed.created_at,
        active_assignment: activeAssignment ? {
          id: activeAssignment.id,
          assigned_at: activeAssignment.assigned_at,
          resident: activeAssignment.residents
        } : null
      }
    })

    return NextResponse.json({ beds: formattedBeds })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Wystąpił nieoczekiwany błąd serwera' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { room_id, label } = body

    if (!room_id || !label) {
      return NextResponse.json({ error: 'Brak wymaganych danych (room_id, label)' }, { status: 400 })
    }

    const { data: bed, error } = await supabase
      .from('beds')
      .insert({
        room_id,
        label,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create bed:', error)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Łóżko z tą etykietą już istnieje w tym pokoju' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Nie udało się utworzyć łóżka' }, { status: 500 })
    }

    return NextResponse.json({ bed })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Wystąpił nieoczekiwany błąd serwera' }, { status: 500 })
  }
}
