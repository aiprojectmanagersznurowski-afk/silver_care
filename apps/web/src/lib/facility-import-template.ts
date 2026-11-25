import * as XLSX from 'xlsx'
import type { RawFacilityRoomRow } from './facility-helpers'

const headers = ['Piętro', 'Numer pokoju', 'Sektor', 'Liczba łóżek', 'Etykiety łóżek']
const aliases = headers.map((header, index) => {
  if (index === 1) return [header, 'Pokój']
  if (index === 4) return [header, 'Etykiety']
  return [header]
})

function normalizedHeader(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl') : ''
}

export function parseFacilityStructure(buffer: ArrayBuffer): RawFacilityRoomRow[] {
  const workbook = XLSX.read(buffer, { type: 'array', raw: true, codepage: 65001 })
  const candidates = workbook.SheetNames.flatMap((name) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: false })
    for (const [index, row] of rows.entries()) {
      const cells = row.map(normalizedHeader)
      const columns = aliases.map((values) => {
        const names = values.map(normalizedHeader)
        return cells.flatMap((cell, column) => names.includes(cell) ? [column] : [])
      })
      if (columns[0].length && columns[1].length) return [{ rows: rows.slice(index + 1), columns }]
    }
    return []
  })
  if (!candidates.length) throw new Error('Nie znaleziono nagłówków Piętro i Numer pokoju.')
  if (candidates.length > 1) throw new Error('Plik zawiera kilka arkuszy z pokojami. Wgraj jeden naraz.')
  const { rows, columns } = candidates[0]
  if (columns.some((column) => column.length > 1)) throw new Error('Plik zawiera powtórzone nagłówki importu.')

  return rows.flatMap((row) => {
    const [floor, number, sector, bedCount, bedLabels] = columns.map(([column]) => {
      const value = row[column]
      return value == null ? undefined : String(value).trim() || undefined
    })
    if (![floor, number, sector, bedCount, bedLabels].some(Boolean)) return []
    return [{ floor, number, sector, bedCount, bedLabels }]
  })
}

export function generateFacilityStructureTemplate(
  fileName = 'formatka_struktury_placowki.xlsx',
  sheetName = 'Instrukcja',
  save = true
) {
  const wsData = [
    headers,
    ['Parter', '101', 'Skrzydło A', '2', 'A, B'],
    ['Parter', '102', 'Skrzydło A', '1', '1'],
    ['1', '201', 'Skrzydło B', '3', '1, 2, 3'],
    ['2', '305', 'Główne', '1', '1'],
  ]
  const instructionsData = [
    ['Kolumna', 'Wymagana?', 'Opis i dozwolone formaty'],
    ['Piętro', 'TAK', 'Oznaczenie piętra lub kondygnacji (tekst, np. Parter, 1, 2, Niski parter)'],
    ['Numer pokoju', 'TAK', 'Numer lub symbol pokoju (unikalny w placówce, np. 101, 204A)'],
    ['Sektor', 'NIE', 'Opcjonalna nazwa skrzydła lub sektora (tekst, np. Skrzydło A, Pawilon 2)'],
    ['Liczba łóżek', 'NIE', 'Liczba łóżek w pokoju (liczba całkowita, np. 2)'],
    ['Etykiety łóżek', 'NIE', 'Etykiety łóżek oddzielone przecinkami (np. "1, 2" lub "A, B, C"). Jeśli podano liczbę łóżek bez etykiet, system wygeneruje etykiety automatycznie.'],
  ]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  const wsInstrukcja = XLSX.utils.aoa_to_sheet(instructionsData)
  XLSX.utils.book_append_sheet(wb, ws, 'Pokoje i Łóżka')
  XLSX.utils.book_append_sheet(wb, wsInstrukcja, sheetName)

  if (save && typeof window !== 'undefined') {
    XLSX.writeFile(wb, fileName)
  }

  return wb
}
