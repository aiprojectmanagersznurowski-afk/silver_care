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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 })
    }

    const role = user.app_metadata?.role as string | undefined
    if (!['org_admin', 'super_admin', 'admin'].includes(role || '')) {
      return NextResponse.json({ error: 'Brak uprawnień administratora placówki' }, { status: 403 })
    }

    const orgId = user.app_metadata?.organization_id as string | undefined
    const body = await request.json()
    const { number, floor, sector } = body

    if (!number || !floor) {
      return NextResponse.json({ error: 'Brak wymaganych danych (number, floor)' }, { status: 400 })
    }

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        organization_id: orgId,
        number: number.toString().trim(),
        floor: floor.toString().trim(),
        sector: sector ? sector.toString().trim() : null
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

    if (room && orgId) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const adminClient = createAdminClient()
      await adminClient.from('audit_logs').insert({
        organization_id: orgId,
        resident_id: null,
        action: 'ROOM_CREATED',
        performed_by: user.id,
        payload: { room_id: room.id, number: room.number, floor: room.floor }
      })
    }

    return NextResponse.json({ room })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Wystąpił nieoczekiwany błąd serwera' }, { status: 500 })
  }
}
