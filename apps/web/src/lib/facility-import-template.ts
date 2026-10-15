import * as XLSX from 'xlsx'

export function generateFacilityStructureTemplate(
  fileName = 'formatka_struktury_placowki.xlsx',
  sheetName = 'Instrukcja',
  save = true
) {
  const wsData = [
    ['Piętro', 'Numer pokoju', 'Sektor', 'Liczba łóżek', 'Etykiety łóżek'],
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
