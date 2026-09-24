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
  async (request, { supabase, user }) => {
    const body = await request.json()
    const { number, floor, sector } = body

    if (!number || !floor) {
      throw new ApiError('Brak wymaganych danych (number, floor)', 400, 'VALIDATION_ERROR')
    }

    const orgId = user.organizationId || (user.rawUser as { app_metadata?: { organization_id?: string } })?.app_metadata?.organization_id

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        organization_id: orgId,
        number: number.toString().trim(),
        floor: floor.toString().trim(),
        sector: sector ? sector.toString().trim() : null,
      })
      .select()
      .single()

    if (error) throw error

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
  },
  { roles: ['org_admin', 'super_admin'] }
)
