import { describe, it, expect } from 'vitest'
import { formatResidentsForExport, generateCsvWithBom, ResidentExportRecord } from '../../apps/web/src/lib/export-helpers'

/**
 * @REQ: ADM-RESIDENT-ADD
 */
describe('Data Export Logic & Formatting (@REQ: ADM-RESIDENT-ADD)', () => {
  const sampleResidents: ResidentExportRecord[] = [
    {
      id: 'res-1',
      first_name: 'Jan',
      last_name: 'Kowalski',
      gender: 'M',
      birth_date: '1944-05-14',
      care_level: 'walking',
      is_zsn: false,
      room_number: '101',
      bed_label: 'A',
      archived_at: null,
      created_at: '2026-01-10T12:00:00Z',
    },
    {
      id: 'res-2',
      first_name: 'Anna',
      last_name: 'Nowak',
      gender: 'F',
      birth_date: '1952-08-12',
      care_level: 'sitting',
      is_zsn: true,
      room_number: '102',
      bed_label: 'B',
      archived_at: null,
      created_at: '2026-02-15T10:00:00Z',
    },
    {
      id: 'res-3',
      first_name: 'Stanisław',
      last_name: 'Wiśniewski',
      gender: 'M',
      birth_date: '1939-11-20',
      care_level: 'bedridden',
      is_zsn: false,
      room_number: null,
      bed_label: null,
      archived_at: '2026-08-01T08:00:00Z',
      created_at: '2025-05-01T09:00:00Z',
    },
  ]

  it('filters by status: active, archived, and all', () => {
    const activeOnly = formatResidentsForExport(sampleResidents, { status: 'active', zsnOnly: false })
    expect(activeOnly.length).toBe(2)
    expect(activeOnly.some((r) => r['Nazwisko'] === 'Wiśniewski')).toBe(false)

    const archivedOnly = formatResidentsForExport(sampleResidents, { status: 'archived', zsnOnly: false })
    expect(archivedOnly.length).toBe(1)
    expect(archivedOnly[0]['Nazwisko']).toBe('Wiśniewski')

    const all = formatResidentsForExport(sampleResidents, { status: 'all', zsnOnly: false })
    expect(all.length).toBe(3)
  })

  it('filters by ZSN package', () => {
    const zsnOnly = formatResidentsForExport(sampleResidents, { status: 'all', zsnOnly: true })
    expect(zsnOnly.length).toBe(1)
    expect(zsnOnly[0]['Nazwisko']).toBe('Nowak')
    expect(zsnOnly[0]['ZSN']).toBe('TAK')
  })

  it('generates CSV with UTF-8 BOM and correct quoting for polish diacritics', () => {
    const formatted = formatResidentsForExport(sampleResidents, { status: 'all', zsnOnly: false })
    const csv = generateCsvWithBom(formatted)

    // Check BOM
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('Wiśniewski')
    expect(csv).toContain('Chodzący')
    expect(csv).toContain('Mężczyzna')
  })
})
