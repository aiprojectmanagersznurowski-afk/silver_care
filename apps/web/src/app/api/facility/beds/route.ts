import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { ApiError } from '@/lib/api-errors'
import { BEDS_SELECT, mapBedsWithActiveAssignment } from '@/lib/facility-beds-mapper'
import { evaluateCapacity, buildCapacityExceededAudit, capacityWarningMessage } from '@/lib/capacity-limit'

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

  // Tylko aktywne przypisania, z polami podopiecznego potrzebnymi widokowi (bez pesel_hash)
  const formattedBeds = mapBedsWithActiveAssignment(beds || [])

  return NextResponse.json({ beds: formattedBeds })
})

export const POST = withAuth(
  async (request, { supabase, user }) => {
    const body = await request.json()
    const { room_id, label, confirm_capacity_exceed } = body

    if (!room_id || !label) {
      throw new ApiError('Brak wymaganych danych (room_id, label)', 400, 'VALIDATION_ERROR')
    }

    // ADM-CAPACITY-LIMIT: łóżko ponad limit miejsc dopiero po świadomym potwierdzeniu (SC-ADM-22/AC3)
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('organization_id')
      .eq('id', room_id)
      .single()
    if (roomErr || !room) throw new ApiError('Nie znaleziono pokoju', 404, 'NOT_FOUND')

    const [{ data: org }, { count: activeBeds }] = await Promise.all([
      supabase.from('organizations').select('resident_limit').eq('id', room.organization_id).single(),
      supabase
        .from('beds')
        .select('id, rooms!inner(organization_id)', { count: 'exact', head: true })
        .eq('rooms.organization_id', room.organization_id)
        .eq('is_active', true),
    ])
    const capacity = evaluateCapacity({
      operation: 'bed_create',
      residentLimit: Number(org?.resident_limit ?? 50),
      currentBeds: activeBeds ?? 0,
      currentResidents: 0,
      added: 1,
    })
    if (capacity.exceeds && confirm_capacity_exceed !== true) {
      return NextResponse.json(
        { error: capacityWarningMessage(capacity), code: 'CAPACITY_LIMIT_EXCEEDED', capacity },
        { status: 409 }
      )
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

    if (capacity.exceeds) {
      const audit = buildCapacityExceededAudit(capacity)
      const { error: auditErr } = await supabase.from('audit_logs').insert({
        organization_id: room.organization_id,
        resident_id: null,
        action: audit.action,
        performed_by: user.id,
        payload: audit.payload,
      })
      if (auditErr) console.error('[CAPACITY_AUDIT_FAIL]', auditErr.code)
    }

    return NextResponse.json({ bed })
  },
  { roles: ['org_admin', 'super_admin'], blockImpersonation: true }
)
