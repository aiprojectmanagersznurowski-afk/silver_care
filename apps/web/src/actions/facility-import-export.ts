'use server'

import { revalidatePath } from 'next/cache'
import {
  RawFacilityRoomRow,
  ValidatedFacilityRoomRow,
  FacilityDryRunResult,
  FacilityExportRoom,
  validateFacilityRows,
} from '@/lib/facility-helpers'
import { requireOrgAdmin } from '@/lib/facility-auth'
import { formatPersonName } from '@/lib/person-name'
import { evaluateCapacity, buildCapacityExceededAudit, capacityWarningMessage, CapacityEvaluation } from '@/lib/capacity-limit'

type FacilityAdminClient = Awaited<ReturnType<typeof requireOrgAdmin>>['adminClient']

/** ADM-CAPACITY-LIMIT: łóżka z importu (tylko poprawne wiersze) wobec limitu miejsc placówki. */
async function evaluateImportCapacity(
  adminClient: FacilityAdminClient,
  orgId: string,
  rows: ValidatedFacilityRoomRow[]
): Promise<CapacityEvaluation> {
  const [{ data: org }, { count: activeBeds }] = await Promise.all([
    adminClient.from('organizations').select('resident_limit').eq('id', orgId).single(),
    adminClient
      .from('beds')
      .select('id, rooms!inner(organization_id)', { count: 'exact', head: true })
      .eq('rooms.organization_id', orgId)
      .eq('is_active', true),
  ])
  const added = rows.filter((r) => r.isValid).reduce((sum, r) => sum + (r.bedLabels?.length || 0), 0)
  return evaluateCapacity({
    operation: 'bed_create',
    residentLimit: Number(org?.resident_limit ?? 50),
    currentBeds: activeBeds ?? 0,
    currentResidents: 0,
    added,
  })
}

interface BedAssignmentRecord {
  unassigned_at: string | null
  residents?: {
    first_name: string
    last_name: string
  } | Array<{
    first_name: string
    last_name: string
  }> | null
}

interface RoomBedRecord {
  id: string
  label: string
  is_active: boolean
  bed_assignments?: BedAssignmentRecord[] | null
}

export async function exportFacilityStructureAction(): Promise<{
  error?: string
  rooms?: FacilityExportRoom[]
  json?: string
}> {
  try {
    const { user, orgId, supabase, adminClient } = await requireOrgAdmin()

    const { data: rawRooms, error: fetchErr } = await supabase
      .from('rooms')
      .select('id, number, floor, sector, is_active, beds(id, label, is_active, bed_assignments(unassigned_at, residents(first_name, last_name)))')
      .eq('organization_id', orgId)
      .order('number', { ascending: true })

    if (fetchErr) {
      return { error: `Błąd podczas pobierania pokoi: ${fetchErr.message}` }
    }

    const rooms: FacilityExportRoom[] = (rawRooms || []).map((r) => {
      const beds = (Array.isArray(r.beds) ? r.beds : []) as unknown as RoomBedRecord[]
      return {
        id: r.id,
        number: r.number,
        floor: r.floor,
        sector: r.sector,
        is_active: r.is_active,
        beds: beds.map((b) => {
          const assignments = Array.isArray(b.bed_assignments) ? b.bed_assignments : []
          const active = assignments.find((a) => a.unassigned_at === null)
          const resident = Array.isArray(active?.residents) ? active.residents[0] : active?.residents
          const residentName = resident
            ? formatPersonName(resident.first_name, resident.last_name)
            : null
          return {
            id: b.id,
            label: b.label,
            is_active: b.is_active,
            occupied: Boolean(active),
            resident_name: residentName,
          }
        }),
      }
    })

    // Zapis audytu
    await adminClient.from('audit_logs').insert({
      organization_id: orgId,
      resident_id: null,
      action: 'FACILITY_SCHEMA_EXPORTED',
      performed_by: user.id,
      payload: {
        rooms_count: rooms.length,
        total_beds: rooms.reduce((acc, rm) => acc + rm.beds.length, 0),
      },
    })

    return {
      rooms,
      json: JSON.stringify({ organization_id: orgId, exported_at: new Date().toISOString(), rooms }, null, 2),
    }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd' }
  }
}

export async function analyzeFacilityImportAction(
  rawRows: RawFacilityRoomRow[]
): Promise<{ error?: string; result?: FacilityDryRunResult; capacityWarning?: string }> {
  try {
    const { orgId, supabase, adminClient } = await requireOrgAdmin()

    // Pobierz istniejące numery pokoi w tej placówce
    const { data: existing, error: existErr } = await supabase
      .from('rooms')
      .select('number')
      .eq('organization_id', orgId)

    if (existErr) {
      return { error: `Błąd pobierania istniejących pokoi: ${existErr.message}` }
    }

    const existingNumbers = new Set<string>((existing || []).map((r) => r.number))
    const result = validateFacilityRows(rawRows, existingNumbers)
    const capacity = await evaluateImportCapacity(adminClient, orgId, result.rows)

    return { result, capacityWarning: capacity.exceeds ? capacityWarningMessage(capacity) : undefined }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Wystąpił błąd analizy pliku' }
  }
}

export async function commitFacilityImportAction(
  validRows: ValidatedFacilityRoomRow[],
  confirmCapacityExceed = false
): Promise<{ error?: string; importedRooms?: number; importedBeds?: number; capacityExceeded?: boolean }> {
  try {
    const { user, orgId, adminClient } = await requireOrgAdmin()

    // ADM-CAPACITY-LIMIT: ponowna ocena po stronie serwera — bez potwierdzenia nic nie jest zapisywane
    const capacity = await evaluateImportCapacity(adminClient, orgId, validRows)
    if (capacity.exceeds && !confirmCapacityExceed) {
      return {
        error: `${capacityWarningMessage(capacity)} Zaznacz potwierdzenie przekroczenia limitu, aby zaimportować.`,
        capacityExceeded: true,
      }
    }

    let importedRooms = 0
    let importedBeds = 0

    for (const r of validRows) {
      if (!r.isValid) continue

      // Wstaw pokój
      const { data: room, error: roomErr } = await adminClient
        .from('rooms')
        .insert({
          organization_id: orgId,
          number: r.number,
          floor: r.floor,
          sector: r.sector,
          is_active: true,
        })
        .select('id')
        .single()

      if (roomErr) {
        return { error: `Błąd podczas tworzenia pokoju ${r.number}: ${roomErr.message}` }
      }
      importedRooms++

      // Wstaw łóżka dla tego pokoju
      if (r.bedLabels && r.bedLabels.length > 0) {
        const bedInserts = r.bedLabels.map((lbl) => ({
          room_id: room.id,
          label: lbl,
          is_active: true,
        }))

        const { data: beds, error: bedErr } = await adminClient
          .from('beds')
          .insert(bedInserts)
          .select('id')

        if (bedErr) {
          return { error: `Błąd podczas tworzenia łóżek w pokoju ${r.number}: ${bedErr.message}` }
        }
        importedBeds += (beds || []).length
      }
    }

    // Zapis audytu
    await adminClient.from('audit_logs').insert({
      organization_id: orgId,
      resident_id: null,
      action: 'FACILITY_SCHEMA_IMPORTED',
      performed_by: user.id,
      payload: {
        imported_rooms: importedRooms,
        imported_beds: importedBeds,
      },
    })

    if (capacity.exceeds) {
      const audit = buildCapacityExceededAudit(capacity)
      await adminClient.from('audit_logs').insert({
        organization_id: orgId,
        resident_id: null,
        action: audit.action,
        performed_by: user.id,
        payload: audit.payload,
      })
    }

    revalidatePath('/admin/facility')
    return { importedRooms, importedBeds }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Wystąpił błąd podczas importu' }
  }
}
