import { describe, it, expect } from 'vitest'
import * as hero from '../../apps/web/src/components/DailySummaryHero'

/**
 * @REQ: FAM-DASHBOARD
 * @REQ: MDR-NO-INTERPRETATION
 *
 * Decyzja Michała 2026-10-26: portal rodziny pokazuje fakty (długość snu, kroki) albo „Brak danych”.
 * Bez ocen zgadywanych z treści raportu („W normie”, „Spokojny”, „Bardzo dobry”) i bez emoji nastroju.
 */
describe('Podsumowanie dnia — tylko fakty (@REQ: FAM-DASHBOARD)', () => {
  it('@REQ: FAM-DASHBOARD - długość snu i kroki z metryk, brak metryki to „Brak danych”', () => {
    expect(hero.heroFacts({ steps: 4210, sleep_hours: 7.5 })).toEqual([
      { label: 'Długość snu', value: '7,5 h' },
      { label: 'Kroki', value: '4210' },
    ])
    expect(hero.heroFacts({ steps: 0 })).toEqual([
      { label: 'Długość snu', value: 'Brak danych' },
      { label: 'Kroki', value: '0' },
    ])
    expect(hero.heroFacts(undefined)).toEqual([
      { label: 'Długość snu', value: 'Brak danych' },
      { label: 'Kroki', value: 'Brak danych' },
    ])
  })

  it('@REQ: MDR-NO-INTERPRETATION - moduł nie wyprowadza ocen samopoczucia z tekstu', () => {
    expect('deriveWellbeing' in hero).toBe(false)
  })
})
