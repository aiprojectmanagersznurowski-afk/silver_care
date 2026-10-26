import { describe, it, expect } from 'vitest'
import { formatSectorName, normalizeSectorInput } from '../../apps/web/src/lib/sector'
import { validateFacilityRows, parseFacilityVoiceJson } from '../../apps/web/src/lib/facility-helpers'

/**
 * @REQ: ADM-FACILITY-MANAGE
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Decyzja Michała 2026-10-26: sektor pokazujemy tak, jak go nazwano (np. „A”, „Skrzydło Północne”),
 * bez dopisywanego przedrostka „Sektor”. Przedrostek wpisany przez użytkownika jest usuwany przy zapisie.
 */
describe('Nazwa sektora bez przedrostka (@REQ: ADM-FACILITY-MANAGE)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - wyświetla samą nazwę sektora', () => {
    expect(formatSectorName('A')).toBe('A')
    expect(formatSectorName('Sektor B-Północ')).toBe('B-Północ')
    expect(formatSectorName('sektor C')).toBe('C')
    expect(formatSectorName('SEKTOR: D')).toBe('D')
    expect(formatSectorName('  Skrzydło A ')).toBe('Skrzydło A')
    expect(formatSectorName('Sektorowe skrzydło')).toBe('Sektorowe skrzydło')
    expect(formatSectorName('Sektor')).toBe('—')
    expect(formatSectorName(null)).toBe('—')
    expect(formatSectorName(undefined)).toBe('—')
    expect(formatSectorName('')).toBe('—')
  })

  it('@REQ: ADM-FACILITY-MANAGE - zapis usuwa przedrostek, pusty sektor to null', () => {
    expect(normalizeSectorInput('Sektor A')).toBe('A')
    expect(normalizeSectorInput(' sektor - Północ ')).toBe('Północ')
    expect(normalizeSectorInput('Pawilon 2')).toBe('Pawilon 2')
    expect(normalizeSectorInput('Sektor')).toBeNull()
    expect(normalizeSectorInput('   ')).toBeNull()
    expect(normalizeSectorInput(null)).toBeNull()
    expect(normalizeSectorInput(undefined)).toBeNull()
  })

  it('@REQ: ADM-FACILITY-MANAGE - import pliku i polecenie głosowe zapisują sektor bez przedrostka', () => {
    const dry = validateFacilityRows([{ floor: '1', number: '901', sector: 'Sektor A', bedCount: 1, bedLabels: '1' }], new Set())
    expect(dry.rows[0].sector).toBe('A')
    expect(parseFacilityVoiceJson('{"number":"902","floor":"1","sector":"sektor B","bedLabels":["1"]}').sector).toBe('B')
  })
})
