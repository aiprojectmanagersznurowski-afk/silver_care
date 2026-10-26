'use server'

import { revalidatePath } from 'next/cache'
import { callEuLlmCompletion } from '@/lib/eu-llm-client'
import {
  RawFacilityRoomRow,
  ValidatedFacilityRoomRow,
  FacilityDryRunResult,
  FacilityExportRoom,
  parseFacilityVoiceJson,
  fallbackExtractFacilityVoiceParams,
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

    try {
      const raw = await callEuLlmCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcription },
        ],
        0.1,
        400
      )

      const parsed = parseFacilityVoiceJson(raw)
      if (!parsed._parseError) {
        return { parsed }
      }
    } catch (llmErr: unknown) {
      const fallback = fallbackExtractFacilityVoiceParams(transcription)
      if (fallback.number || fallback.floor || fallback.bedLabels) {
        return { parsed: fallback }
      }
      throw llmErr
    }

    const fallback = fallbackExtractFacilityVoiceParams(transcription)
    if (fallback.number || fallback.floor || fallback.bedLabels) {
      return { parsed: fallback }
    }

    return { error: 'Nie udało się wyodrębnić parametrów pokoju. Wprowadź dane ręcznie.' }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Błąd parsowania notatki głosowej' }
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
