import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // public.bed_count and public.occupied_beds and public.free_beds are available on rooms
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*, beds:bed_count, occupied:occupied_beds, free:free_beds')
      .order('number', { ascending: true })

    if (error) {
      console.error('Failed to fetch rooms:', error)
      return NextResponse.json({ error: 'Nie udało się pobrać pokoi' }, { status: 500 })
    }

    return NextResponse.json({ rooms })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Wystąpił nieoczekiwany błąd serwera' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { number, floor, sector } = body

    if (!number || !floor) {
      return NextResponse.json({ error: 'Brak wymaganych danych (number, floor)' }, { status: 400 })
    }

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        number,
        floor,
        sector: sector || null
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create room:', error)
      // Check if duplicate key
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Pokój o tym numerze już istnieje' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Nie udało się utworzyć pokoju' }, { status: 500 })
    }

    return NextResponse.json({ room })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Wystąpił nieoczekiwany błąd serwera' }, { status: 500 })
  }
}
