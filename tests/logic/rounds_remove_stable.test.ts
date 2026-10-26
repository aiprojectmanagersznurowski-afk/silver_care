import { describe, it, expect } from 'vitest'
import { quickLogRoutineObservationAction } from '../../apps/web/src/actions/bulk-reports'

/**
 * @REQ: NUR-BOARD
 *
 * Test weryfikujący wycofanie mechanizmu generowania pozorowanych wpisów rutynowych
 * („Stan stabilny”) zgodnie z regułą zakazu fabrykowania danych w fallbackach (NUR-ROUNDS-REMOVE-STABLE).
 */
describe('Wycofanie pozorowanych wpisów Stan stabilny (@REQ: NUR-BOARD)', () => {
  it('odrzuca próbę dodania generycznego wpisu rutynowej obserwacji @REQ: NUR-BOARD', async () => {
    const result = await quickLogRoutineObservationAction('res-123', 'Obchód rutynowy: Stan stabilny')
    expect(result.success).toBe(false)
    expect(result.error).toContain('wycofana')
  })
})
