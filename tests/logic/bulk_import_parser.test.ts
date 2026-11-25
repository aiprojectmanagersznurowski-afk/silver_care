import { expect, it } from 'vitest'
import * as XLSX from '../../apps/web/node_modules/xlsx'
import { parseBulkImportFile } from '@/lib/bulk-import-parser'

function workbook(rows: (string | number)[][], formattedPesel = false) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Instrukcja'], ['Dane w zakładce poniżej']]), 'Instrukcja')
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  if (formattedPesel) sheet.C3.z = '00000000000'
  XLSX.utils.book_append_sheet(book, sheet, 'Eksport')
  return new File([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], 'synthetic.xlsx')
}

it('rozpoznaje arkusz i kolejność po nagłówkach oraz zachowuje zero z formatu PESEL @REQ: ADM-RESIDENT-ADD', async () => {
  const file = workbook([
    ['Eksport placówki'],
    ['Nazwisko', 'Pokój', 'Numer PESEL', 'Imię', 'Stan'],
    ['Fikcyjna', '101', 1234567890, 'Anna', 'chodzący'],
  ], true)
  expect((await parseBulkImportFile(file)).rows).toMatchObject([
    { firstName: 'Anna', lastName: 'Fikcyjna', nationalId: '01234567890', careLevel: 'chodzący' },
  ])
})

it('odrzuca plik bez rozpoznanych nagłówków @REQ: ADM-RESIDENT-ADD', async () => {
  const file = workbook([['A', 'B', 'C'], ['Anna', 'Fikcyjna', '01234567890']])
  expect(await parseBulkImportFile(file)).toEqual({ error: expect.stringContaining('nagłówków') })
})
