import * as XLSX from 'xlsx'

export function generateResidentTemplate(
  fileName = 'formatka_importu_podopiecznych.xlsx',
  sheetName = 'Instrukcja',
  save = true
) {
  const wsData = [
    ['Imię', 'Nazwisko', 'PESEL', 'Stan', 'ZSN', 'Uwagi'],
    ['Jan', 'Kowalski', '44051401458', 'chodzący', 'nie', 'Samodzielny'],
    ['Anna', 'Nowak', '52081203447', 'siedzący', 'tak', 'Wymaga asekuracji przy wstawaniu'],
    ['Stanisław', 'Wiśniewski', '38031502491', 'leżący', 'tak', 'Wymaga regularnej zmiany pozycji'],
  ]
  const instructionsData = [
    ['Kolumna', 'Wymagana?', 'Opis i dozwolone formaty'],
    ['Imię', 'TAK', 'Imię podopiecznego (tekst, np. Jan)'],
    ['Nazwisko', 'TAK', 'Nazwisko podopiecznego (tekst, np. Kowalski)'],
    ['PESEL', 'TAK', 'Dokładnie 11 cyfr, prawidłowa suma kontrolna. Na tej podstawie system automatycznie wylicza datę urodzenia i płeć.'],
    ['Stan', 'NIE', 'Dopuszczalne wartości: chodzący, siedzący, leżący, paliatywny. Domyślnie: chodzący.'],
    ['ZSN', 'NIE', 'Zespół Stacjonarnej Niedyspozycji: tak / nie (lub 1 / 0). Domyślnie: nie.'],
    ['Uwagi', 'NIE', 'Dowolny tekst z uwagami opiekuńczymi, alergiami lub zaleceniami.'],
  ]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  const wsInstrukcja = XLSX.utils.aoa_to_sheet(instructionsData)
  XLSX.utils.book_append_sheet(wb, ws, 'Podopieczni')
  XLSX.utils.book_append_sheet(wb, wsInstrukcja, sheetName)

  if (save && typeof window !== 'undefined') {
    XLSX.writeFile(wb, fileName)
  }

  return wb
}
