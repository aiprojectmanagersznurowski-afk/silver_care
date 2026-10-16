import * as XLSX from 'xlsx'
import { RawResidentRow } from './bulk-import-helpers'

export async function parseBulkImportFile(file: File): Promise<{ rows?: RawResidentRow[]; error?: string }> {
  try {
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = wb.SheetNames[0]
    const ws = wb.Sheets[firstSheetName]
    const jsonData: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

    if (jsonData.length < 2) {
      return { error: 'Plik jest pusty lub zawiera tylko nagłówki.' }
    }

    const rows: RawResidentRow[] = []
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i]
      if (!row || row.length === 0 || row.every((c) => c === undefined || c === null || c === '')) {
        continue
      }
      rows.push({
        firstName: row[0] != null ? String(row[0]) : undefined,
        lastName: row[1] != null ? String(row[1]) : undefined,
        nationalId: row[2] != null ? String(row[2]) : undefined,
        careLevel: row[3] != null ? String(row[3]) : undefined,
        isZsn: row[4] != null ? (typeof row[4] === 'boolean' ? row[4] : String(row[4])) : undefined,
        notes: row[5] != null ? String(row[5]) : undefined,
      })
    }

    if (rows.length === 0) {
      return { error: 'Nie znaleziono wierszy z danymi w arkuszu.' }
    }

    return { rows }
  } catch (err: unknown) {
    return {
      error: 'Błąd przetwarzania pliku: ' + (err instanceof Error ? err.message : 'Nieznany błąd.'),
    }
  }
}
