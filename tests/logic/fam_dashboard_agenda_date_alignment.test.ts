import { describe, it, expect } from 'vitest'
import { formatHeroDateLabel } from '../../apps/web/src/components/DailySummaryHero'
import { getCategory } from '../../apps/web/src/components/AgendaTimelineClient'
import { ResidentSwitcher } from '../../apps/web/src/components/ResidentSwitcher'
import { AgendaView } from '../../apps/web/src/components/AgendaView'

describe('FAM-DASHBOARD-AGENDA-DATE-ALIGNMENT: Spójność dat i kategorii agendy', () => {
  it('DailySummaryHero dynamicznie formatuje etykiety Dzisiaj, Wczoraj i daty wstecz @REQ: FAM-DASHBOARD', () => {
    const fixedNow = new Date('2026-05-15T12:00:00.000Z')
    const today = new Date('2026-05-15T08:30:00.000Z')
    const yesterday = new Date('2026-05-14T18:00:00.000Z')
    const pastDate = new Date('2026-05-10T10:00:00.000Z')

    const todayLabel = formatHeroDateLabel(today, fixedNow)
    expect(todayLabel).toMatch(/^Dzisiaj\s*·/i)

    const yesterdayLabel = formatHeroDateLabel(yesterday, fixedNow)
    expect(yesterdayLabel).toMatch(/^Wczoraj\s*·/i)

    const pastLabel = formatHeroDateLabel(pastDate, fixedNow)
    expect(pastLabel).not.toMatch(/Dzisiaj|Wczoraj/)
    expect(pastLabel).toContain('2026')
  })


  it('AgendaTimelineClient kategoryzuje wpisy na podstawie type oraz tytułu @REQ: FAM-AGENDA', () => {
    // Type explicit
    // FAM-AGENDA-NO-MEDICAL (2026-10-26): widok rodziny nie ma kategorii leków
    expect(getCategory({ id: '1', time: '08:00', title: 'Dowolny tytuł', type: 'medication' })).toBe('other')
    expect(getCategory({ id: '2', time: '12:00', title: 'Dowolny tytuł', type: 'meal' })).toBe('meal')
    expect(getCategory({ id: '3', time: '14:00', title: 'Dowolny tytuł', type: 'therapy' })).toBe('therapy')
    expect(getCategory({ id: '4', time: '16:00', title: 'Dowolny tytuł', type: 'rest' })).toBe('rest')
    expect(getCategory({ id: '5', time: '19:00', title: 'Dowolny tytuł', type: 'hygiene' })).toBe('hygiene')
    expect(getCategory({ id: '6', time: '20:00', title: 'Dowolny tytuł', type: 'other' })).toBe('other')

    // Title heuristic fallback
    expect(getCategory({ id: '7', time: '07:30', title: 'Poranne leki i zastrzyk' })).not.toBe('medication')
    expect(getCategory({ id: '8', time: '13:00', title: 'Ciepły obiad i deser' })).toBe('meal')
    expect(getCategory({ id: '9', time: '10:00', title: 'Terapia zajęciowa' })).toBe('therapy')
    expect(getCategory({ id: '10', time: '15:00', title: 'Popołudniowa drzemka i odpoczynek' })).toBe('rest')
    expect(getCategory({ id: '11', time: '18:00', title: 'Kąpiel i toaleta wieczorna' })).toBe('hygiene')
    expect(getCategory({ id: '12', time: '11:00', title: 'Spacer po ogrodzie' })).toBe('activity')
  })

  it('wycofane komponenty ResidentSwitcher i AgendaView są poprawnymi funkcjami komponentów React @REQ: FAM-DASHBOARD', () => {
    expect(typeof ResidentSwitcher).toBe('function')
    expect(typeof AgendaView).toBe('function')
  })
})
