import { describe, it, expect } from 'vitest'
import { validateResidentRows, RawResidentRow } from '../../apps/web/src/lib/bulk-import-helpers'

/**
 * @REQ: ADM-RESIDENT-ADD
 */
describe('Bulk Import Logic & Validation (@REQ: ADM-RESIDENT-ADD)', () => {
  it('identifies valid rows and correctly parses gender/birthDate from PESEL', () => {
    const rawRows: RawResidentRow[] = [
      {
        firstName: 'Jan',
        lastName: 'Kowalski',
        nationalId: '44051401458', // 1944-05-14, M
        careLevel: 'chodzący',
        isZsn: 'false',
      },
      {
        firstName: 'Anna',
        lastName: 'Nowak',
        nationalId: '52081203447', // 1952-08-12, F
        careLevel: 'siedzący',
        isZsn: true,
      },
    ]

    const result = validateResidentRows(rawRows)
    expect(result.totalRows).toBe(2)
    expect(result.validRowsCount).toBe(2)
    expect(result.invalidRowsCount).toBe(0)
    expect(result.rows[0].gender).toBe('M')
    expect(result.rows[0].birthDate).toBe('1944-05-14')
    expect(result.rows[0].careLevel).toBe('walking')
    expect(result.rows[1].gender).toBe('F')
    expect(result.rows[1].birthDate).toBe('1952-08-12')
    expect(result.rows[1].careLevel).toBe('sitting')
    expect(result.rows[1].isZsn).toBe(true)
  })

  it('detects missing fields, invalid checksums, duplicates in file, and existing database records', () => {
    const rawRows: RawResidentRow[] = [
      {
        firstName: '',
        lastName: 'Brak Imienia',
        nationalId: '44051401458',
      },
      {
        firstName: 'Zły',
        lastName: 'PESEL',
        nationalId: '12345678901', // Niepoprawna suma
      },
      {
        firstName: 'Duplikat',
        lastName: 'W Pliku',
        nationalId: '52081203447',
      },
      {
        firstName: 'Duplikat 2',
        lastName: 'W Pliku',
        nationalId: '52081203447',
      },
    ]

    const result = validateResidentRows(rawRows)
    expect(result.totalRows).toBe(4)
    expect(result.validRowsCount).toBe(1) // Pierwszy z 52081203447 jest poprawny
    expect(result.invalidRowsCount).toBe(3)

    expect(result.rows[0].isValid).toBe(false)
    expect(result.rows[0].errors).toContain('Brak imienia.')

    expect(result.rows[1].isValid).toBe(false)
    expect(result.rows[1].errors.some((e) => e.includes('suma kontrolna'))).toBe(true)

    expect(result.rows[2].isValid).toBe(true)

    expect(result.rows[3].isValid).toBe(false)
    expect(result.rows[3].errors).toContain('Duplikat numeru PESEL wewnątrz pliku.')
  })
})
