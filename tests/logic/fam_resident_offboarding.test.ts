import { describe, it, expect } from 'vitest'
import {
  OFFBOARDING_RETENTION_DAYS,
  evaluateFamilyOffboardingState,
  buildMemorialArchiveDocument,
} from '../../apps/web/src/lib/family-offboarding'

/**
 * @REQ: FAM-DASHBOARD
 * @REQ: ADM-ARCHIVE
 * @REQ: SEC-RETENTION
 */
describe('Portal Rodziny — widok pożegnalny, archiwum pamiątkowe i 30-dniowe okno retencji (FAM-RESIDENT-OFFBOARDING)', () => {
  it('@REQ: FAM-DASHBOARD - aktywny podopieczny otrzymuje tryb active', () => {
    const state = evaluateFamilyOffboardingState(
      {
        death_date: null,
        contract_end_date: null,
        archived_at: null,
      },
      new Date('2026-10-29T12:00:00Z')
    )

    expect(state.mode).toBe('active')
  })

  it('@REQ: FAM-DASHBOARD - po zgonie w ciągu 30 dni prezentuje wyciszony widok memorial_window z odliczaniem dni (AC1, AC3)', () => {
    const state = evaluateFamilyOffboardingState(
      {
        death_date: '2026-10-20',
        contract_end_date: '2026-10-20',
        archived_at: null,
      },
      new Date('2026-10-29T12:00:00Z')
    )

    expect(OFFBOARDING_RETENTION_DAYS).toBe(30)
    expect(state.mode).toBe('memorial_window')
    if (state.mode === 'memorial_window') {
      expect(state.reason).toBe('deceased')
      expect(state.endDate).toBe('2026-10-20')
      expect(state.expiryDate).toBe('2026-11-19')
      expect(state.daysRemaining).toBe(21)
    }
  })

  it('@REQ: ADM-ARCHIVE - po wypisie w ciągu 30 dni prezentuje widok memorial_window z powodem discharged (AC1, AC3)', () => {
    const state = evaluateFamilyOffboardingState(
      {
        death_date: null,
        contract_end_date: '2026-10-15',
        archived_at: null,
      },
      new Date('2026-10-29T12:00:00Z')
    )

    expect(state.mode).toBe('memorial_window')
    if (state.mode === 'memorial_window') {
      expect(state.reason).toBe('discharged')
      expect(state.endDate).toBe('2026-10-15')
      expect(state.expiryDate).toBe('2026-11-14')
      expect(state.daysRemaining).toBe(16)
    }
  })

  it('@REQ: SEC-RETENTION - po upływie 30 dni od zgonu/wypisu lub po archived_at odcina dostęp (retention_expired, AC4)', () => {
    const expiredByDate = evaluateFamilyOffboardingState(
      {
        death_date: '2026-09-15',
        contract_end_date: '2026-09-15',
        archived_at: null,
      },
      new Date('2026-10-29T12:00:00Z')
    )
    expect(expiredByDate.mode).toBe('retention_expired')

    const expiredByArchive = evaluateFamilyOffboardingState(
      {
        death_date: '2026-10-25',
        contract_end_date: '2026-10-25',
        archived_at: '2026-10-26T08:00:00Z',
      },
      new Date('2026-10-29T12:00:00Z')
    )
    expect(expiredByArchive.mode).toBe('retention_expired')
  })

  it('@REQ: FAM-DASHBOARD - generuje pamiątkowe archiwum pobytu z raportami behawioralnymi bez słowa pacjent (AC2, MDR-VOCABULARY)', () => {
    const doc = buildMemorialArchiveDocument({
      resident: {
        first_name: 'Helena',
        last_name: 'Kowalska',
        death_date: '2026-10-20',
        contract_end_date: '2026-10-20',
      },
      reports: [
        {
          id: 'rep-1',
          created_at: '2026-10-18T18:00:00Z',
          content: {
            text: 'Pani Helena uczestniczyła w zajęciach plastycznych i spacerze w ogrodzie.',
            metrics: { steps: 3200, sleep_hours: 7.5 },
          },
        },
      ],
      generatedAt: '2026-10-29',
    })

    expect(doc.fileName).toBe('archiwum-pamiatkowe-kowalska-helena.txt')
    expect(doc.content).toContain('Kowalska Helena')
    expect(doc.content).toContain('Pani Helena uczestniczyła w zajęciach plastycznych')
    expect(doc.content).toContain('3200')
    expect(doc.content.toLowerCase()).not.toMatch(/pacjent/)
  })
})
