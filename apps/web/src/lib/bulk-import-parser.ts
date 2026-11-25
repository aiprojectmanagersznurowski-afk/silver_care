import * as XLSX from 'xlsx'
import type { RawResidentRow } from './bulk-import-helpers'

const aliases = {
  firstName: ['IMIE'],
  lastName: ['NAZWISKO'],
  nationalId: ['PESEL', 'NUMER PESEL', 'NR PESEL'],
  careLevel: ['STAN', 'PROFIL SPRAWNOSCI'],
  isZsn: ['ZSN'],
  notes: ['UWAGI'],
} satisfies Partial<Record<keyof RawResidentRow, string[]>>
type Column = keyof typeof aliases

const requiredColumns: Column[] = ['firstName', 'lastName', 'nationalId']
const allColumns = Object.keys(aliases) as Column[]

function normalizeHeader(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLocaleUpperCase('pl').normalize('NFD').replace(/\p{M}/gu, '').replace(/Ł/g, 'L').replace(/\s+/g, ' ')
    : ''
}

function matchHeader(row: unknown[]) {
  const values = row.map(normalizeHeader)
  const columns = Object.fromEntries(allColumns.map((key) => [
    key, values.flatMap((value, index) => aliases[key].includes(value) ? [index] : []),
  ])) as Record<Column, number[]>
  return requiredColumns.every((key) => columns[key].length > 0) ? columns : null
}

function dataHeader(sheet: XLSX.WorkSheet) {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
  for (const [index, row] of raw.entries()) {
    const columns = matchHeader(row)
    if (columns) return { sheet, raw, index, columns }
  }
  return null
}

export async function parseBulkImportFile(file: File): Promise<{ rows?: RawResidentRow[]; error?: string }> {
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', codepage: 65001 })
    const candidates = workbook.SheetNames.map((name) => dataHeader(workbook.Sheets[name])).filter((sheet) => sheet !== null)
    if (!candidates.length) return { error: 'Nie znaleziono nagłówków: Imię, Nazwisko i PESEL. Sprawdź format pliku.' }
    if (candidates.length > 1) return { error: 'Kilka arkuszy zawiera dane podopiecznych. Wgraj jeden arkusz naraz.' }

    const { sheet, raw, index, columns } = candidates[0]
    if (allColumns.some((key) => columns[key].length > 1)) {
      return { error: 'Arkusz zawiera powtórzone nagłówki importu. Zostaw po jednej kolumnie na pole.' }
    }

    const formatted = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false })
    const rows: RawResidentRow[] = []
    for (let i = index + 1; i < raw.length; i++) {
      const row = raw[i]
      if (!allColumns.some((key) => row[columns[key][0]] != null && row[columns[key][0]] !== '')) continue
      const value = (key: Column) => row[columns[key][0]]
      const asString = (key: Column) => value(key) != null ? String(value(key)) : undefined
      const nationalId = formatted[i]?.[columns.nationalId[0]]
      const zsn = value('isZsn')
      rows.push({
        firstName: asString('firstName'),
        lastName: asString('lastName'),
        nationalId: typeof nationalId === 'string' && /^\d{11}$/.test(nationalId) ? nationalId : asString('nationalId'),
        careLevel: asString('careLevel'),
        isZsn: typeof zsn === 'boolean' ? zsn : asString('isZsn'),
        notes: asString('notes'),
      })
    }
    return rows.length ? { rows } : { error: 'Nie znaleziono wierszy z danymi w arkuszu.' }
  } catch {
    return { error: 'Nie udało się odczytać pliku. Sprawdź format i spróbuj ponownie.' }
  }
}
