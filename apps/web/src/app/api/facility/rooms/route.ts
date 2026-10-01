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
    .select(`
      *,
      beds:bed_count,
      occupied:occupied_beds,
      free:free_beds,
      beds_list:beds(
        id,
        is_active,
        bed_assignments(
          id,
          unassigned_at,
          resident:residents(gender)
        )
      )
    `)
    .order('number', { ascending: true })

  if (error) throw error

  const enrichedRooms = (rooms || []).map((room) => {
    let males = 0
    let females = 0
    const bedsList = (room as unknown as { beds_list?: Array<{ is_active: boolean; bed_assignments?: Array<{ unassigned_at: string | null; resident?: { gender?: string } }> }> })?.beds_list
    if (bedsList) {
      for (const b of bedsList) {
        if (b.is_active && b.bed_assignments) {
          for (const a of b.bed_assignments) {
            if (a.unassigned_at === null && a.resident?.gender) {
              if (a.resident.gender === 'M') males++
              else if (a.resident.gender === 'F') females++
            }
          }
        }
      }
    }
    return {
      ...room,
      beds_list: undefined,
      genderDistribution: { males, females },
    }
  })

  return NextResponse.json({ rooms: enrichedRooms })
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
