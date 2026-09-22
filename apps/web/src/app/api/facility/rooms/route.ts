import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { ApiError } from '@/lib/api-errors'

/**
 * @REQ: ADM-FACILITY-OCCUPANCY
 * @REQ: SEC-SESSION
 * @REQ: ORG-ISOLATION
 */
export const GET = withAuth(async (_request, { supabase }) => {
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('*, beds:bed_count, occupied:occupied_beds, free:free_beds')
    .order('number', { ascending: true })

  if (error) throw error

  return NextResponse.json({ rooms })
})

export const POST = withAuth(
  async (request, { supabase }) => {
    const body = await request.json()
    const { number, floor, sector } = body

    if (!number || !floor) {
      throw new ApiError('Brak wymaganych danych (number, floor)', 400, 'VALIDATION_ERROR')
    }

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        number,
        floor,
        sector: sector || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ room })
  },
  { roles: ['org_admin', 'super_admin'] }
)
