import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { ApiError } from '@/lib/api-errors'

interface BedAssignmentData {
  id: string
  assigned_at: string
  unassigned_at: string | null
  resident_id: string
  residents: {
    first_name: string
    last_name: string
    pesel_hash: string
  } | null
}

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
    .select(`
      id, room_id, label, is_active, created_at,
      assignments:bed_assignments(id, assigned_at, unassigned_at, resident_id, residents(first_name, last_name, pesel_hash))
    `)
    .order('label', { ascending: true })

  if (roomId) {
    query = query.eq('room_id', roomId)
  }

  const { data: beds, error } = await query
  if (error) throw error

  // Filter out historical assignments (we only care about active ones)
  const formattedBeds = (beds || []).map((bed) => {
    const activeAssignment = bed.assignments?.find((a) => !a.unassigned_at)
    return {
      id: bed.id,
      room_id: bed.room_id,
      label: bed.label,
      is_active: bed.is_active,
      created_at: bed.created_at,
      active_assignment: activeAssignment
        ? {
            id: activeAssignment.id,
            assigned_at: activeAssignment.assigned_at,
            resident: Array.isArray(activeAssignment.residents)
              ? activeAssignment.residents[0]
              : activeAssignment.residents,
          }
        : null,
    }
  })

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
  { roles: ['org_admin', 'super_admin'] }
)
