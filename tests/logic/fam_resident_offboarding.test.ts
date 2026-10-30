import { describe, it, expect } from 'vitest'
import { OFFBOARDING_RETENTION_DAYS as CONTRACT_OFFBOARDING_RETENTION_DAYS } from '@silvercare/contracts/src/generated/roles'
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
  it('@REQ: SEC-RETENTION - OFFBOARDING_RETENTION_DAYS pochodzi z kontraktu i wynosi 30 dni', () => {
    expect(CONTRACT_OFFBOARDING_RETENTION_DAYS).toBe(30)
    expect(OFFBOARDING_RETENTION_DAYS).toBe(CONTRACT_OFFBOARDING_RETENTION_DAYS)
  })

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

  it('@REQ: FAM-DASHBOARD - zgłoszenie zgonu przez personel (death_reported_at) przed zatwierdzeniem kierownika nie przełącza portalu rodziny', () => {
    const state = evaluateFamilyOffboardingState(
      {
        death_date: null,
        death_reported_at: '2026-10-29T10:00:00Z',
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

  it('@REQ: FAM-DASHBOARD - obliczenia retencji uwzględniają strefę Europe/Warsaw przy zdarzeniach tuż przed/po północy', () => {
    // 2026-10-29 23:30:00 UTC to 2026-10-30 00:30:00 czasu polskiego (Europe/Warsaw, UTC+1 w czasie standardowym)
    const lateNightUtc = new Date('2026-10-29T23:30:00Z')
    const state = evaluateFamilyOffboardingState(
      {
        death_date: '2026-10-30',
        contract_end_date: '2026-10-30',
        archived_at: null,
      },
      lateNightUtc
    )

    expect(state.mode).toBe('memorial_window')
    if (state.mode === 'memorial_window') {
      expect(state.daysRemaining).toBe(30)
      expect(state.expiryDate).toBe('2026-11-29')
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

  it('@REQ: FAM-DASHBOARD - dla osoby zmarłej generuje pamiątkowe archiwum z prefiksem archiwum-pamiatkowe (AC2, MDR-VOCABULARY)', () => {
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
    expect(doc.content).toContain('SILVER CARE — PAMIĄTKOWE ARCHIWUM POBYTU PODOPIECZNEGO')
    expect(doc.content).toContain('Kowalska Helena')
    expect(doc.content).toContain('Pani Helena uczestniczyła w zajęciach plastycznych')
    expect(doc.content).toContain('3200')
    expect(doc.content.toLowerCase()).not.toMatch(/pacjent/)
  })

  it('@REQ: ADM-ARCHIVE - dla osoby wypisanej generuje archiwum raportów z pobytu (bez słowa pamiątkowe w nazwie i tytule)', () => {
    const doc = buildMemorialArchiveDocument({
      resident: {
        first_name: 'Jan',
        last_name: 'Nowak',
        death_date: null,
        contract_end_date: '2026-10-15',
      },
      reports: [
        {
          id: 'rep-2',
          created_at: '2026-10-14T12:00:00Z',
          content: {
            text: 'Pan Jan spędził popołudnie na czytaniu prasy.',
            metrics: { steps: 1500, sleep_hours: 8 },
          },
        },
      ],
      generatedAt: '2026-10-29',
    })

    expect(doc.fileName).toBe('archiwum-pobytu-nowak-jan.txt')
    expect(doc.content).toContain('SILVER CARE — ARCHIWUM RAPORTÓW Z POBYTU PODOPIECZNEGO')
    expect(doc.content).not.toContain('PAMIĄTKOWE')
    expect(doc.content).toContain('Nowak Jan')
    expect(doc.content.toLowerCase()).not.toMatch(/pacjent/)
  })
})
