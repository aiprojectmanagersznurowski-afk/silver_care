import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { validateResidentRows, RawResidentRow, evaluateCapacityExceeded } from '../../apps/web/src/lib/bulk-import-helpers'

/**
 * @REQ: ADM-RESIDENT-ADD
 */
describe('Bulk Import Logic & Validation (@REQ: ADM-RESIDENT-ADD)', () => {
  // Sól hasha pochodzi wyłącznie ze środowiska (SEC-PESEL-HASH) — test ustawia własną.
  beforeAll(() => {
    vi.stubEnv('PESEL_HASH_SALT', 'test-salt-bulk-import')
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })

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

  it('correctly evaluates capacity limit overflow and computes excess count @REQ: ADM-RESIDENT-ADD', () => {
    // Przypadek 1: Import mieści się w limicie (10 obecnych + 15 nowych <= 30)
    const withinLimit = evaluateCapacityExceeded(15, 10, 30)
    expect(withinLimit.willExceedLimit).toBe(false)
    expect(withinLimit.projectedTotal).toBe(25)
    expect(withinLimit.excessCount).toBe(0)
    expect(withinLimit.currentResidentCount).toBe(10)
    expect(withinLimit.residentLimit).toBe(30)

    // Przypadek 2: Import przekracza limit (40 obecnych + 25 nowych > 50)
    const exceeded = evaluateCapacityExceeded(25, 40, 50)
    expect(exceeded.willExceedLimit).toBe(true)
    expect(exceeded.projectedTotal).toBe(65)
    expect(exceeded.excessCount).toBe(15)
    expect(exceeded.currentResidentCount).toBe(40)
    expect(exceeded.residentLimit).toBe(50)
  })

  it('evaluates capacity limits and projections accurately without negative excess @REQ: ADM-RESIDENT-ADD', () => {
    // Dokładnie równy limit (20 + 10 = 30, limit 30)
    const exact = evaluateCapacityExceeded(10, 20, 30)
    expect(exact.willExceedLimit).toBe(false)
    expect(exact.projectedTotal).toBe(30)
    expect(exact.excessCount).toBe(0)

    // Przekroczenie o 1
    const overByOne = evaluateCapacityExceeded(11, 20, 30)
    expect(overByOne.willExceedLimit).toBe(true)
    expect(overByOne.projectedTotal).toBe(31)
    expect(overByOne.excessCount).toBe(1)

    // Zero nowych wierszy
    const zeroNew = evaluateCapacityExceeded(0, 25, 30)
    expect(zeroNew.willExceedLimit).toBe(false)
    expect(zeroNew.projectedTotal).toBe(25)
    expect(zeroNew.excessCount).toBe(0)

    // Placówka już przepełniona przed importem
    const alreadyOver = evaluateCapacityExceeded(5, 35, 30)
    expect(alreadyOver.willExceedLimit).toBe(true)
    expect(alreadyOver.projectedTotal).toBe(40)
    expect(alreadyOver.excessCount).toBe(10)
  })
})
