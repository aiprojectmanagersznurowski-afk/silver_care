'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { callEuLlmCompletion } from '@/lib/eu-llm-client'
import {
  RawFacilityRoomRow,
  ValidatedFacilityRoomRow,
  FacilityDryRunResult,
  FacilityExportRoom,
  validateFacilityRows,
  parseFacilityVoiceJson,
} from '@/lib/facility-helpers'

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
      const beds = Array.isArray(r.beds) ? r.beds : []
      return {
        id: r.id,
        number: r.number,
        floor: r.floor,
        sector: r.sector,
        is_active: r.is_active,
        beds: beds.map((b: any) => {
          const assignments = Array.isArray(b.bed_assignments) ? b.bed_assignments : []
          const active = assignments.find((a: any) => a.unassigned_at === null)
          const residentName = active?.residents
            ? `${active.residents.first_name} ${active.residents.last_name}`
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
  } catch (err: any) {
    return { error: err.message || 'Wystąpił nieoczekiwany błąd' }
  }
}

export async function analyzeFacilityImportAction(
  rawRows: RawFacilityRoomRow[]
): Promise<{ error?: string; result?: FacilityDryRunResult }> {
  try {
    const { orgId, supabase } = await requireOrgAdmin()

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

    return { result }
  } catch (err: any) {
    return { error: err.message || 'Wystąpił błąd analizy pliku' }
  }
}

export async function commitFacilityImportAction(
  validRows: ValidatedFacilityRoomRow[]
): Promise<{ error?: string; importedRooms?: number; importedBeds?: number }> {
  try {
    const { user, orgId, adminClient } = await requireOrgAdmin()

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

    revalidatePath('/admin/facility')
    return { importedRooms, importedBeds }
  } catch (err: any) {
    return { error: err.message || 'Wystąpił błąd podczas importu' }
  }
}

export async function parseFacilityVoiceNoteAction(
  transcription: string
): Promise<{ error?: string; parsed?: ReturnType<typeof parseFacilityVoiceJson> }> {
  try {
    await requireOrgAdmin()

    const systemPrompt = `Jesteś asystentem ekstrakcji danych struktury placówki opiekuńczej.
Z surowego opisu słownego wyodrębnij parametry dodawanego pokoju:
- number: numer pokoju (np. "101", "204B")
- floor: oznaczenie piętra (np. "Parter", "1", "2")
- sector: sektor lub skrzydło (np. "A", "Północ", "Zachodnie") lub null
- bedCount: liczba łóżek jako liczba całkowita (np. 2)
- bedLabels: tablica etykiet łóżek (np. ["1", "2"] lub ["A", "B"]) jeśli wymieniono, w przeciwnym razie null

ZASADY:
1. Zwróć WYŁĄCZNIE poprawny JSON bez formatowania markdown.
2. Format wyjściowy strictly matching:
{"number":"101","floor":"Parter","sector":null,"bedCount":2,"bedLabels":["1","2"]}
3. Jeśli jakaś wartość nie padła w notatce, ustaw null.`

    const raw = await callEuLlmCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcription },
      ],
      0.1,
      400
    )

    const parsed = parseFacilityVoiceJson(raw)
    return { parsed }
  } catch (err: any) {
    return { error: err.message || 'Błąd parsowania notatki głosowej' }
  }
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
    const sector = (data.sector || '').trim() || null
    const bedLabels = (data.bedLabels || []).map((s) => s.trim()).filter(Boolean)

    if (!number || !floor) {
      return { error: 'Numer pokoju i piętro są wymagane.' }
    }

    // Sprawdź czy pokój już istnieje
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
  } catch (err: any) {
    return { error: err.message || 'Wystąpił nieoczekiwany błąd' }
  }
}

