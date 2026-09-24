'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  OptimizerRoom,
  OptimizerBed,
  OptimizerOccupant,
  FacilityAllocationMetrics,
  RelocationSuggestion,
  pseudonymizeResident,
  analyzeCurrentAllocation,
  generateRelocationSuggestions,
} from '@/lib/bed-allocation-optimizer'

interface RawResidentAssignment {
  bed_id: string
  resident_id: string
  residents: {
    id: string
    first_name: string
    last_name: string
    gender: string
    care_level: string
    is_zsn: boolean
    archived_at: string | null
  } | null
}

interface RawBedWithRoom {
  id: string
  rooms: {
    organization_id: string
  } | null
}

async function requireOrgAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Brak autoryzacji')
  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) throw new Error('Brak przypisanej placówki')
  const role = user.app_metadata?.role as string | undefined
  if (!['org_admin', 'super_admin', 'admin'].includes(role || '')) {
    throw new Error('Brak uprawnień administratora placówki')
  }
  return { user, orgId, supabase, adminClient: createAdminClient() }
}

export async function analyzeBedAllocationAction(): Promise<{
  error?: string
  metrics?: FacilityAllocationMetrics
  suggestions?: RelocationSuggestion[]
}> {
  try {
    const { orgId, adminClient } = await requireOrgAdmin()

    // 1. Pobierz pokoje danej placówki
    const { data: rawRooms, error: roomsErr } = await adminClient
      .from('rooms')
      .select('id, number, floor, sector, is_active')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('number', { ascending: true })

    if (roomsErr) {
      return { error: `Błąd pobierania pokoi: ${roomsErr.message}` }
    }

    const rooms: OptimizerRoom[] = (rawRooms || []).map((r) => ({
      id: r.id,
      number: r.number,
      floor: r.floor,
      sector: r.sector,
      isActive: r.is_active,
    }))

    const roomIds = rooms.map((r) => r.id)
    if (roomIds.length === 0) {
      return {
        metrics: {
          totalRooms: 0,
          totalBeds: 0,
          occupiedBeds: 0,
          freeBeds: 0,
          genderConflictsCount: 0,
          mobilityMismatchCount: 0,
          overallScore: 100,
          roomAnalyses: [],
        },
        suggestions: [],
      }
    }

    // 2. Pobierz łóżka dla pokoi w placówce
    const { data: rawBeds, error: bedsErr } = await adminClient
      .from('beds')
      .select('id, room_id, label, is_active')
      .in('room_id', roomIds)
      .eq('is_active', true)

    if (bedsErr) {
      return { error: `Błąd pobierania łóżek: ${bedsErr.message}` }
    }

    const beds: OptimizerBed[] = (rawBeds || []).map((b) => ({
      id: b.id,
      roomId: b.room_id,
      label: b.label,
      isActive: b.is_active,
    }))

    const bedIds = beds.map((b) => b.id)

    // 3. Pobierz aktywne przypisania w tej placówce
    const { data: rawAssignments, error: assignErr } = await adminClient
      .from('bed_assignments')
      .select('bed_id, resident_id, residents(id, first_name, last_name, gender, care_level, is_zsn, archived_at)')
      .in('bed_id', bedIds.length > 0 ? bedIds : ['00000000-0000-0000-0000-000000000000'])
      .is('unassigned_at', null)

    if (assignErr) {
      return { error: `Błąd pobierania przypisań: ${assignErr.message}` }
    }

    const bedToRoomMap = new Map<string, string>()
    for (const b of beds) bedToRoomMap.set(b.id, b.roomId)

    const typedAssignments = (rawAssignments as unknown as RawResidentAssignment[]) || []
    const occupants: OptimizerOccupant[] = []

    for (const a of typedAssignments) {
      const res = a.residents
      if (!res || res.archived_at) continue // Pomiń zarchiwizowanych

      const roomId = bedToRoomMap.get(a.bed_id)
      if (!roomId) continue

      const careLevelVal =
        res.care_level === 'sitting' || res.care_level === 'bedridden' || res.care_level === 'hospice'
          ? res.care_level
          : 'walking'

      occupants.push({
        residentId: res.id,
        pseudonym: pseudonymizeResident(res.first_name, res.last_name),
        gender: res.gender === 'F' ? 'F' : 'M',
        careLevel: careLevelVal,
        isZsn: Boolean(res.is_zsn),
        currentBedId: a.bed_id,
        currentRoomId: roomId,
      })
    }

    const metrics = analyzeCurrentAllocation(rooms, beds, occupants)
    const suggestions = generateRelocationSuggestions(rooms, beds, occupants)

    return { metrics, suggestions }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Wystąpił błąd podczas analizy alokacji'
    return { error: message }
  }
}

export async function executeBedRelocationAction(
  relocations: Array<{
    residentId: string
    toBedId: string
    reason?: string
  }>
): Promise<{ error?: string; success?: boolean; executedCount?: number }> {
  try {
    const { user, orgId, adminClient } = await requireOrgAdmin()

    if (!relocations || relocations.length === 0) {
      return { error: 'Brak relokacji do wykonania' }
    }

    // Walidacja tenant isolation dla każdego pensjonariusza i docelowego łóżka
    const residentIds = relocations.map((r) => r.residentId)
    const toBedIds = relocations.map((r) => r.toBedId)

    // Weryfikacja mieszkańców w tej samej organizacji
    const { data: validResidents, error: resErr } = await adminClient
      .from('residents')
      .select('id')
      .eq('organization_id', orgId)
      .in('id', residentIds)

    if (resErr || !validResidents || validResidents.length !== residentIds.length) {
      return { error: 'Część pensjonariuszy nie należy do bieżącej placówki.' }
    }

    // Weryfikacja docelowych łóżek w tej samej organizacji (poprzez rooms)
    const { data: validBeds, error: bedErr } = await adminClient
      .from('beds')
      .select('id, rooms!inner(organization_id)')
      .in('id', toBedIds)

    if (bedErr) {
      return { error: `Błąd weryfikacji łóżek: ${bedErr.message}` }
    }

    const typedBeds = (validBeds as unknown as RawBedWithRoom[]) || []
    const validBedIds = new Set(
      typedBeds
        .filter((b) => b.rooms?.organization_id === orgId)
        .map((b) => b.id)
    )

    for (const toBedId of toBedIds) {
      if (!validBedIds.has(toBedId)) {
        return { error: 'Docelowe łóżko nie należy do bieżącej placówki.' }
      }
    }

    // Wykonanie transferów atomowych przez procedurę transfer_resident_bed
    let executedCount = 0
    for (const rel of relocations) {
      const { error: transferErr } = await adminClient.rpc('transfer_resident_bed', {
        p_resident_id: rel.residentId,
        p_new_bed_id: rel.toBedId,
      })

      if (transferErr) {
        return {
          error: `Błąd podczas przenoszenia pensjonariusza ${rel.residentId}: ${transferErr.message}`,
        }
      }
      executedCount++
    }

    // Zapis audytowy
    await adminClient.from('audit_logs').insert({
      organization_id: orgId,
      resident_id: null,
      action: 'RESIDENTS_BED_ALLOCATION_OPTIMIZED',
      performed_by: user.id,
      payload: {
        executed_relocations: executedCount,
        relocations: relocations.map((r) => ({
          resident_id: r.residentId,
          to_bed_id: r.toBedId,
          reason: r.reason || null,
        })),
      },
    })

    revalidatePath('/admin/facility')
    revalidatePath('/admin/residents')

    return { success: true, executedCount }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Błąd podczas wykonywania relokacji'
    return { error: message }
  }
}
