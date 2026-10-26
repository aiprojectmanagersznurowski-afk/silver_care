import { normalizeSectorInput } from '@/lib/sector'

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
    const sector = normalizeSectorInput(raw.sector)
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
      sector: normalizeSectorInput(parsed.sector) ?? undefined,
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

export function fallbackExtractFacilityVoiceParams(text: string): {
  number?: string
  floor?: string
  sector?: string
  bedLabels?: string[]
} {
  const normalized = text.toLowerCase()
  let number: string | undefined
  let floor: string | undefined
  let sector: string | undefined
  let bedLabels: string[] | undefined

  // 1. Numer pokoju: np. "pokój 101", "pokój numer 205B", "sala 12"
  const roomMatch = text.match(/(?:pok[oó]j|sala)\s*(?:nr|numer)?\s*([0-9]+[a-zA-Z]?|[a-zA-Z]+-?[0-9]+)/i)
  if (roomMatch) {
    number = roomMatch[1]
  }

  // 2. Piętro: "parter", "piętro 1", "piętro pierwsze", "na pierwszym piętrze", "1 piętro"
  if (normalized.includes('parter')) {
    floor = 'Parter'
  } else {
    const beforeMatch = text.match(/(pierwsz[a-zęóąśłżźćń]*|drugi[a-zęóąśłżźćń]*|trzeci[a-zęóąśłżźćń]*|czwart[a-zęóąśłżźćń]*|pi[aą]t[a-zęóąśłżźćń]*|[0-9]+)\s*pi[eę]tr/i)
    const afterMatch = text.match(/pi[eę]tr(?:o|ze|a|u)?\s*([0-9]+|pierwsz[a-zęóąśłżźćń]*|drugi[a-zęóąśłżźćń]*|trzeci[a-zęóąśłżźćń]*|czwart[a-zęóąśłżźćń]*|pi[aą]t[a-zęóąśłżźćń]*)/i)
    const floorToken = beforeMatch ? beforeMatch[1].toLowerCase() : (afterMatch ? afterMatch[1].toLowerCase() : '')
    if (floorToken) {
      if (floorToken.startsWith('pierwsz') || floorToken === '1') floor = '1'
      else if (floorToken.startsWith('drug') || floorToken === '2') floor = '2'
      else if (floorToken.startsWith('trzec') || floorToken === '3') floor = '3'
      else if (floorToken.startsWith('czwart') || floorToken === '4') floor = '4'
      else if (floorToken.startsWith('piąt') || floorToken.startsWith('piat') || floorToken === '5') floor = '5'
      else if (/^[0-9]+$/.test(floorToken)) floor = floorToken
    }
  }

  // 3. Sektor / skrzydło: np. "skrzydło A", "sektor Zachód"
  const sectorMatch = text.match(/(?:skrzyd[łl]o|sektor)\s*([a-zA-Z0-9ąćęłńóśźż\s]+?)(?:,|\.|$|łóżk|sala|pokój)/i)
  if (sectorMatch) {
    sector = sectorMatch[1].trim()
  }

  // 4. Etykiety i liczba łóżek:
  // Jawne etykiety (np. "łóżka A i B", "łóżka o oznaczeniach A, B, C")
  const explicitLabelsMatch = text.match(/ł[oó]żk(?:a|o|i)?\s*(?:o\s*oznaczeniach|o\s*nazwach|oznaczone\s*jako|:)?\s*([A-Za-z0-9](?:\s*(?:,|i|oraz)\s*[A-Za-z0-9])+)/i)
  if (explicitLabelsMatch) {
    const rawLabels = explicitLabelsMatch[1]
      .split(/(?:,|\si\s|\soraz\s|\s+)/)
      .map(s => s.trim())
      .filter(s => s && s.length <= 4 && !['dwa', 'trzy', 'cztery', 'pięć'].includes(s.toLowerCase()))
    if (rawLabels.length > 0) {
      bedLabels = rawLabels
    }
  }

  // Jeśli brak jawnych etykiet, wyznacz etykiety z liczby łóżek (np. "3 łóżka", "dwa łóżka")
  if (!bedLabels || bedLabels.length === 0) {
    const countMatch = text.match(/([0-9]+|jedno|dwa|trzy|cztery|pięć|sześć)\s*ł[oó]żk/i)
    if (countMatch) {
      const countWordMap: Record<string, number> = {
        'jedno': 1, '1': 1,
        'dwa': 2, '2': 2,
        'trzy': 3, '3': 3,
        'cztery': 4, '4': 4,
        'pięć': 5, '5': 5,
        'sześć': 6, '6': 6,
      }
      const count = countWordMap[countMatch[1].toLowerCase()] || parseInt(countMatch[1], 10)
      if (count > 0) {
        bedLabels = Array.from({ length: count }, (_, i) => String(i + 1))
      }
    }
  }

  return { number, floor, sector, bedLabels }
}

