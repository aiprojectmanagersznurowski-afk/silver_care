export interface ExportFilterOptions {
  status: 'active' | 'archived' | 'all'
  zsnOnly: boolean
}

export interface ResidentExportRecord {
  id: string
  first_name: string
  last_name: string
  gender: string | null
  birth_date: string | null
  care_level: string | null
  is_zsn: boolean | null
  room_number: string | null
  bed_label: string | null
  archived_at: string | null
  created_at: string
}

export interface ExportRowFormatted {
  'Imię': string
  'Nazwisko': string
  'Płeć': string
  'Data urodzenia': string
  'Profil sprawności': string
  'ZSN': string
  'Pokój': string
  'Łóżko': string
  'Status': string
  'Data przyjęcia': string
}

export function formatResidentsForExport(
  residents: ResidentExportRecord[],
  options: ExportFilterOptions
): ExportRowFormatted[] {
  let filtered = residents

  if (options.status === 'active') {
    filtered = filtered.filter((r) => !r.archived_at)
  } else if (options.status === 'archived') {
    filtered = filtered.filter((r) => Boolean(r.archived_at))
  }

  if (options.zsnOnly) {
    filtered = filtered.filter((r) => Boolean(r.is_zsn))
  }

  return filtered.map((r) => {
    let genderStr = 'Nieokreślona'
    if (r.gender === 'M') genderStr = 'Mężczyzna'
    else if (r.gender === 'F') genderStr = 'Kobieta'

    let careStr = 'Brak'
    if (r.care_level === 'walking') careStr = 'Chodzący'
    else if (r.care_level === 'sitting') careStr = 'Siedzący'
    else if (r.care_level === 'bedridden') careStr = 'Leżący'
    else if (r.care_level === 'hospice') careStr = 'Opieka paliatywna'

    const statusStr = r.archived_at ? 'Wypisany / zarchiwizowany' : 'Aktywny'
    const createdDate = r.created_at ? r.created_at.split('T')[0] : ''

    return {
      'Imię': r.first_name,
      'Nazwisko': r.last_name,
      'Płeć': genderStr,
      'Data urodzenia': r.birth_date || '—',
      'Profil sprawności': careStr,
      'ZSN': r.is_zsn ? 'TAK' : 'NIE',
      'Pokój': r.room_number || 'Brak',
      'Łóżko': r.bed_label || 'Brak',
      'Status': statusStr,
      'Data przyjęcia': createdDate,
    }
  })
}

export function generateCsvWithBom(rows: ExportRowFormatted[]): string {
  if (rows.length === 0) {
    return '\uFEFFImię;Nazwisko;Płeć;Data urodzenia;Profil sprawności;ZSN;Pokój;Łóżko;Status;Data przyjęcia\n'
  }

  const headers = Object.keys(rows[0])
  const headerLine = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(';')

  const dataLines = rows.map((row) => {
    return (headers as Array<keyof ExportRowFormatted>)
      .map((header) => {
        const val = (row[header] || '').toString()
        return `"${val.replace(/"/g, '""')}"`
      })
      .join(';')
  })

  // Prefiks BOM \uFEFF zapewnia bezbłędne dekodowanie UTF-8 w MS Excel
  return '\uFEFF' + [headerLine, ...dataLines].join('\r\n')
}
