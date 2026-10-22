import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { ApiError } from '@/lib/api-errors'
import { BEDS_SELECT, mapBedsWithActiveAssignment } from '@/lib/facility-beds-mapper'

/**
 * @REQ: ADM-FACILITY-OCCUPANCY
 * @REQ: SEC-SESSION
 * @REQ: ORG-ISOLATION
 */
export const GET = withAuth(async (request, { supabase }) => {
  const { searchParams } = new URL(request.url)
  const roomId = searchParams.get('roomId')

  let query = supabase
    .from('beds')
    .select(BEDS_SELECT)
    .order('label', { ascending: true })

  if (roomId) {
    query = query.eq('room_id', roomId)
  }

  const { data: beds, error } = await query
  if (error) throw error

  // Tylko aktywne przypisania, z polami pensjonariusza potrzebnymi widokowi (bez pesel_hash)
  const formattedBeds = mapBedsWithActiveAssignment(beds || [])

  return NextResponse.json({ beds: formattedBeds })
})

export const POST = withAuth(
  async (request, { supabase }) => {
    const body = await request.json()
    const { room_id, label } = body

    if (!room_id || !label) {
      throw new ApiError('Brak wymaganych danych (room_id, label)', 400, 'VALIDATION_ERROR')
    }

    const { data: bed, error } = await supabase
      .from('beds')
      .insert({
        room_id,
        label,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ bed })
  },
  { roles: ['org_admin', 'super_admin'], blockImpersonation: true }
)
