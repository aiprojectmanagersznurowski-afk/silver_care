import { describe, it, expect } from 'vitest'
import { analyzeReportCompleteness } from '../../apps/web/src/lib/completeness-gate'

/**
 * @REQ: REPORT-AI-FEEDBACK
 */
describe('Report Completeness AI Quality Gate (@REQ: REPORT-AI-FEEDBACK)', () => {
  it('detects missing dimensions and calculates completeness score', () => {
    // Notatka tylko o spacerze (aktywność) bez posiłków i nastroju
    const partialText = 'Podopieczny wyszedł na krótki spacer do ogrodu w towarzystwie opiekuna.'
    const result = analyzeReportCompleteness(partialText)

    expect(result.isComplete).toBe(false)
    expect(result.coveredCount).toBe(1)
    expect(result.totalCount).toBe(4)
    expect(result.scorePercent).toBe(25)

    const activityDim = result.dimensions.find((d) => d.id === 'activity')
    expect(activityDim?.isCovered).toBe(true)

    const mealsDim = result.dimensions.find((d) => d.id === 'meals')
    expect(mealsDim?.isCovered).toBe(false)

    expect(result.missingLabels).toContain('Posiłki i apetyt')
    expect(result.missingLabels).toContain('Nastrój i samopoczucie')
    expect(result.missingLabels).toContain('Sen i odpoczynek')
  })

  it('recognizes a well-rounded note covering all 4 core family care dimensions', () => {
    const fullText = `Nasz podopieczny spędził dziś bardzo pogodny dzień, z uśmiechem witając personel.
Zjadł obiad z dużym apetytem i wypił ciepłą herbatę.
Po południu chętnie uczestniczył w spacerze w ogrodzie.
Noc minęła spokojnie, a podopieczny obudził się wypoczęty.`

    const result = analyzeReportCompleteness(fullText)
    expect(result.isComplete).toBe(true)
    expect(result.coveredCount).toBe(4)
    expect(result.scorePercent).toBe(100)
    expect(result.missingLabels.length).toBe(0)
  })

  it('contains non-clinical suggestions compliant with MDR and language boundaries', () => {
    const result = analyzeReportCompleteness('')
    for (const dim of result.dimensions) {
      // Zakaz słowa pacjent
      expect(dim.suggestion.toLowerCase()).not.toContain('pacjent')
    }
  })
})
