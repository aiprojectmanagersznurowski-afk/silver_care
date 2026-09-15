import { parseNationalId } from './admission-helpers'
import crypto from 'crypto'

export interface RawResidentRow {
  firstName?: string
  lastName?: string
  nationalId?: string
  careLevel?: string
  isZsn?: boolean | string
  notes?: string
}

export interface ValidatedResidentRow {
  rowNumber: number
  firstName: string
  lastName: string
  nationalId: string
  gender: 'M' | 'F'
  birthDate: string
  careLevel: 'walking' | 'sitting' | 'bedridden' | 'hospice'
  isZsn: boolean
  notes: string | null
  isValid: boolean
  errors: string[]
}

export interface DryRunResult {
  totalRows: number
  validRowsCount: number
  invalidRowsCount: number
  rows: ValidatedResidentRow[]
}

export function validateResidentRows(
  rawRows: RawResidentRow[],
  existingHashes: Set<string> = new Set()
): DryRunResult {
  const seenInFile = new Set<string>()
  const rows: ValidatedResidentRow[] = []

  let rowNum = 1
  for (const raw of rawRows) {
    rowNum++
    const errors: string[] = []

    const firstName = (raw.firstName || '').toString().trim()
    const lastName = (raw.lastName || '').toString().trim()
    const idVal = (raw.nationalId || '').toString().trim()
    const careLevelRaw = (raw.careLevel || '').toString().trim().toLowerCase()
    const isZsnRaw = raw.isZsn

    if (!firstName) errors.push('Brak imienia.')
    if (!lastName) errors.push('Brak nazwiska.')
    if (!idVal) {
      errors.push('Brak numeru PESEL.')
    }

    let parsedGender: 'M' | 'F' = 'M'
    let parsedBirthDate = ''

    if (idVal) {
      const parsed = parseNationalId(idVal)
      if (!parsed.valid || !parsed.birthDate || !parsed.gender) {
        errors.push(parsed.error || 'Nieprawidłowy PESEL.')
      } else {
        parsedGender = parsed.gender
        parsedBirthDate = parsed.birthDate

        if (seenInFile.has(idVal)) {
          errors.push('Duplikat numeru PESEL wewnątrz pliku.')
        } else {
          seenInFile.add(idVal)
        }

        const hash = crypto.createHmac('sha256', 'silvercare_pesel_salt').update(idVal).digest('hex')
        if (existingHashes.has(hash)) {
          errors.push('Pensjonariusz o tym numerze PESEL już istnieje w bazie placówki.')
        }
      }
    }

    let careLevel: 'walking' | 'sitting' | 'bedridden' | 'hospice' = 'walking'
    if (careLevelRaw === 'sitting' || careLevelRaw === 'siedzący' || careLevelRaw === 'wozek' || careLevelRaw === 'wózek') {
      careLevel = 'sitting'
    } else if (careLevelRaw === 'bedridden' || careLevelRaw === 'leżący' || careLevelRaw === 'lezacy') {
      careLevel = 'bedridden'
    } else if (careLevelRaw === 'hospice' || careLevelRaw === 'hospicjum' || careLevelRaw === 'paliatywny') {
      careLevel = 'hospice'
    } else if (careLevelRaw === 'walking' || careLevelRaw === 'chodzący' || careLevelRaw === 'chodzacy' || !careLevelRaw) {
      careLevel = 'walking'
    } else {
      errors.push(`Nieznany profil sprawności: ${careLevelRaw}. Dozwolone: chodzący, siedzący, leżący, paliatywny.`)
    }

    const isZsn = isZsnRaw === true || isZsnRaw === 'true' || isZsnRaw === '1' || isZsnRaw === 'tak' || isZsnRaw === 'yes'
    const notes = raw.notes ? raw.notes.toString().trim() : null

    rows.push({
      rowNumber: rowNum,
      firstName,
      lastName,
      nationalId: idVal,
      gender: parsedGender,
      birthDate: parsedBirthDate,
      careLevel,
      isZsn,
      notes,
      isValid: errors.length === 0,
      errors,
    })
  }

  const validRowsCount = rows.filter((r) => r.isValid).length
  const invalidRowsCount = rows.length - validRowsCount

  return {
    totalRows: rows.length,
    validRowsCount,
    invalidRowsCount,
    rows,
  }
}
