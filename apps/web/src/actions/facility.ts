'use server'

import { revalidatePath } from 'next/cache'
import {
  RawFacilityRoomRow,
  ValidatedFacilityRoomRow,
  FacilityDryRunResult,
  FacilityExportRoom,
} from '@/lib/facility-helpers'
import { requireOrgAdmin } from '@/lib/facility-auth'
import {
  exportFacilityStructureAction as exportImpl,
  analyzeFacilityImportAction as analyzeImpl,
  commitFacilityImportAction as commitImpl,
} from './facility-import-export'
import { normalizeSectorInput } from '@/lib/sector'

export async function exportFacilityStructureAction(): Promise<{
  error?: string
  rooms?: FacilityExportRoom[]
  json?: string
}> {
  return exportImpl()
}

export async function analyzeFacilityImportAction(
  rawRows: RawFacilityRoomRow[]
): Promise<{ error?: string; result?: FacilityDryRunResult }> {
  return analyzeImpl(rawRows)
}

export async function commitFacilityImportAction(
  validRows: ValidatedFacilityRoomRow[]
): Promise<{ error?: string; importedRooms?: number; importedBeds?: number }> {
  return commitImpl(validRows)
}

export async function createRoomWithBedsAction(data: {
  number: string
  floor: string
  sector?: string | null
  bedLabels?: string[]
}): Promise<{ error?: string; success?: boolean; roomId?: string }> {
  try {
    const { user, orgId, adminClient } = await requireOrgAdmin()

    const number = (data.number || '').trim()
    const floor = (data.floor || '').trim()
    const sector = normalizeSectorInput(data.sector)
    const bedLabels = (data.bedLabels || []).map((s) => s.trim()).filter(Boolean)

    if (!number || !floor) {
      return { error: 'Numer pokoju i piętro są wymagane.' }
    }

    const { data: existing } = await adminClient
      .from('rooms')
      .select('id')
      .eq('organization_id', orgId)
      .eq('number', number)
      .maybeSingle()

    if (existing) {
      return { error: `Pokój o numerze "${number}" już istnieje w tej placówce.` }
    }

    const { data: room, error: roomErr } = await adminClient
      .from('rooms')
      .insert({
        organization_id: orgId,
        number,
        floor,
        sector,
        is_active: true,
      })
      .select('id')
      .single()

    if (roomErr || !room) {
      return { error: `Błąd podczas tworzenia pokoju: ${roomErr?.message || 'Błąd'}` }
    }

    if (bedLabels.length > 0) {
      const bedInserts = bedLabels.map((lbl) => ({
        room_id: room.id,
        label: lbl,
        is_active: true,
      }))
      const { error: bedErr } = await adminClient.from('beds').insert(bedInserts)
      if (bedErr) {
        return { error: `Błąd podczas tworzenia łóżek: ${bedErr.message}` }
      }
    }

    await adminClient.from('audit_logs').insert({
      organization_id: orgId,
      resident_id: null,
      action: 'FACILITY_ROOM_CREATED',
      performed_by: user.id,
      payload: {
        room_id: room.id,
        number,
        floor,
        sector,
        bed_count: bedLabels.length,
        bed_labels: bedLabels,
      },
    })

    revalidatePath('/admin/facility')
    return { success: true, roomId: room.id }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd' }
  }
}
