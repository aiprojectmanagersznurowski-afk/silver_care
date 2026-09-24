/**
 * facility-helpers.ts — logika pomocnicza dla modułu struktury placówki (ADM-FACILITY-IO-VOICE).
 * Zgodność z contracts/facility.contract.mjs.
 */

export interface RawFacilityRoomRow {
  floor?: string
  number?: string
  sector?: string
  bedCount?: string | number
  bedLabels?: string
}

export interface ValidatedFacilityRoomRow {
  rowNumber: number
  floor: string
  number: string
  sector: string | null
  bedLabels: string[]
  isValid: boolean
  errors: string[]
}

export interface FacilityDryRunResult {
  totalRows: number
  validRowsCount: number
  invalidRowsCount: number
  rows: ValidatedFacilityRoomRow[]
}

export interface FacilityExportRoom {
  id: string
  number: string
  floor: string
  sector: string | null
  is_active: boolean
  beds: Array<{
    id: string
    label: string
    is_active: boolean
    occupied: boolean
    resident_name?: string | null
  }>
}

export function validateFacilityRows(
  rawRows: RawFacilityRoomRow[],
  existingRoomNumbers: Set<string>
): FacilityDryRunResult {
  const seenInFile = new Set<string>()
  const rows: ValidatedFacilityRoomRow[] = []
  let rowNum = 1

  for (const raw of rawRows) {
    rowNum++
    const errors: string[] = []

    const floor = (raw.floor || '').toString().trim()
    const number = (raw.number || '').toString().trim()
    const sector = (raw.sector || '').toString().trim() || null
    const bedCountRaw = Number(raw.bedCount) || 0
    const bedLabelsRaw = (raw.bedLabels || '').toString().trim()

    if (!floor) errors.push('Brak oznaczenia piętra.')
    if (!number) {
      errors.push('Brak numeru pokoju.')
    } else if (seenInFile.has(number)) {
      errors.push(`Duplikat numeru pokoju "${number}" w pliku.`)
    } else if (existingRoomNumbers.has(number)) {
      errors.push(`Pokój "${number}" już istnieje w bazie placówki.`)
    } else {
      seenInFile.add(number)
    }

    let bedLabels: string[] = []
    if (bedLabelsRaw) {
      bedLabels = bedLabelsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    } else if (bedCountRaw > 0) {
      bedLabels = Array.from({ length: bedCountRaw }, (_, i) => String(i + 1))
    }

    if (bedLabels.length === 0 && errors.length === 0) {
      errors.push('Brak łóżek — podaj liczbę łóżek lub etykiety oddzielone przecinkami.')
    }

    const labelSet = new Set(bedLabels)
    if (labelSet.size !== bedLabels.length) {
      errors.push('Duplikaty etykiet łóżek w ramach jednego pokoju.')
    }

    rows.push({
      rowNumber: rowNum,
      floor,
      number,
      sector,
      bedLabels,
      isValid: errors.length === 0,
      errors,
    })
  }

  return {
    totalRows: rawRows.length,
    validRowsCount: rows.filter((r) => r.isValid).length,
    invalidRowsCount: rows.filter((r) => !r.isValid).length,
    rows,
  }
}

export function parseFacilityVoiceJson(raw: string): {
  number?: string
  floor?: string
  sector?: string
  bedLabels?: string[]
  _parseError?: boolean
} {
  try {
    let cleaned = raw.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim()
    cleaned = cleaned.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim()
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return { _parseError: true }
    }
    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1))
    const bedCount = parsed.bedCount ? Number(parsed.bedCount) : 0
    return {
      number: (parsed.number || parsed.room_number || '').toString().trim() || undefined,
      floor: parsed.floor ? parsed.floor.toString().trim() : undefined,
      sector: parsed.sector ? parsed.sector.toString().trim() : undefined,
      bedLabels: Array.isArray(parsed.bedLabels)
        ? parsed.bedLabels.map(String).map((s: string) => s.trim()).filter(Boolean)
        : bedCount > 0
        ? Array.from({ length: bedCount }, (_, i) => String(i + 1))
        : undefined,
    }
  } catch {
    return { _parseError: true }
  }
}
