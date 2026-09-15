/**
 * Strażnik kompletności raportu opiekuńczego dla rodziny (AI Quality Gate)
 * Analiza 4 wymiarów troski rodziny:
 * 1. Posiłki i apetyt (śniadanie, obiad, kolacja, płyny, apetyt)
 * 2. Nastrój i samopoczucie (humor, uśmiech, zadowolenie, spokój, samopoczucie)
 * 3. Aktywność i integracja (spacer, warsztaty, rozmowa, ćwiczenia, ogród)
 * 4. Sen i wypoczynek (noc, sen, drzemka, odpoczynek)
 *
 * Zgodność z MDR i ADR-004:
 * Komunikaty asystenta są empatyczne i nienarzucające się (Nudge), bez słownictwa medycznego ani klinicznego.
 */

export interface CompletenessDimension {
  id: 'meals' | 'mood' | 'activity' | 'rest'
  label: string
  isCovered: boolean
  suggestion: string
}

export interface CompletenessAnalysis {
  isComplete: boolean
  scorePercent: number
  coveredCount: number
  totalCount: number
  dimensions: CompletenessDimension[]
  missingLabels: string[]
}

const DIMENSION_KEYWORDS = {
  meals: [
    'apetyt', 'posiłk', 'śniadani', 'obiad', 'kolacj', 'zjadł', 'zjadła', 'jedzeni', 'pił', 'piła', 'płyn', 'herbata', 'woda', 'zupa'
  ],
  mood: [
    'nastrój', 'samopoczuci', 'humor', 'uśmiech', 'spokojn', 'zadowolon', 'pogodn', 'radosn', 'rozmown', 'smutn', 'wyciszon'
  ],
  activity: [
    'spacer', 'aktywnoś', 'zajęci', 'ogród', 'ćwiczeni', 'integracj', 'towarzystw', 'spacerował', 'świetlic', 'muzykoterap', 'rehabilitacj'
  ],
  rest: [
    'sen', 'spani', 'drzemk', 'odpoczynek', 'odpoczywał', 'noc', 'przespał', 'wypoczęt', 'zasnął', 'zasnęła'
  ]
}

export function analyzeReportCompleteness(text: string): CompletenessAnalysis {
  const normalized = (text || '').toLowerCase()

  const checkKeywords = (keywords: string[]) => {
    return keywords.some((kw) => normalized.includes(kw))
  }

  const hasMeals = checkKeywords(DIMENSION_KEYWORDS.meals)
  const hasMood = checkKeywords(DIMENSION_KEYWORDS.mood)
  const hasActivity = checkKeywords(DIMENSION_KEYWORDS.activity)
  const hasRest = checkKeywords(DIMENSION_KEYWORDS.rest)

  const dimensions: CompletenessDimension[] = [
    {
      id: 'meals',
      label: 'Posiłki i apetyt',
      isCovered: hasMeals,
      suggestion: 'Warto dopisać krótką wzmiankę o apetycie lub posiłkach (np. jak smakował obiad).'
    },
    {
      id: 'mood',
      label: 'Nastrój i samopoczucie',
      isCovered: hasMood,
      suggestion: 'Bliscy docenią informację o nastroju podopiecznego (np. czy był pogodny dzień).'
    },
    {
      id: 'activity',
      label: 'Aktywność i integracja',
      isCovered: hasActivity,
      suggestion: 'Możesz wspomnieć o spacerze, udziale w zajęciach lub rozmowach ze współlokatorami.'
    },
    {
      id: 'rest',
      label: 'Sen i odpoczynek',
      isCovered: hasRest,
      suggestion: 'Brak informacji o jakości snu lub popołudniowym odpoczynku.'
    }
  ]

  const coveredCount = dimensions.filter((d) => d.isCovered).length
  const totalCount = dimensions.length
  const scorePercent = Math.round((coveredCount / totalCount) * 100)
  const isComplete = coveredCount === totalCount
  const missingLabels = dimensions.filter((d) => !d.isCovered).map((d) => d.label)

  return {
    isComplete,
    scorePercent,
    coveredCount,
    totalCount,
    dimensions,
    missingLabels
  }
}
