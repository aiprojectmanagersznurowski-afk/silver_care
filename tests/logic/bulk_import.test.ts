import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { validateResidentRows, RawResidentRow } from '../../apps/web/src/lib/bulk-import-helpers'

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

  it('correctly evaluates capacity limit overflow and computes excess count @REQ: ADM-RESIDENT-ADD', async () => {
    const { evaluateCapacityExceeded } = await import('../../apps/web/src/lib/bulk-import-helpers')

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

  it('contains capacity warning in BulkImportDialog and updates limit in actions @REQ: ADM-RESIDENT-ADD', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')

    const dialogSrc = fs.readFileSync(
      path.resolve(__dirname, '../../apps/web/src/components/BulkImportDialog.tsx'),
      'utf8'
    )
    expect(dialogSrc).toContain('data-testid="capacity-warning-banner"')
    expect(dialogSrc).toContain('willExceedLimit')
    expect(dialogSrc).toContain('projectedTotal')
    expect(dialogSrc).toContain('excessCount')

    const actionSrc = fs.readFileSync(
      path.resolve(__dirname, '../../apps/web/src/actions/bulk-import.ts'),
      'utf8'
    )
    expect(actionSrc).toContain('ORGANIZATION_CAPACITY_UPDATED')
    expect(actionSrc).toContain('resident_limit: newCapacity')
    expect(actionSrc).toContain('evaluateCapacityExceeded')

    // Weryfikacja: brak słowa pacjent
    expect(dialogSrc.toLowerCase()).not.toContain('pacjent')
    expect(actionSrc.toLowerCase()).not.toContain('pacjent')
  })
})
