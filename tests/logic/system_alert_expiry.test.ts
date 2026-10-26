import { describe, it, expect } from 'vitest'
import {
  validateSystemAlertInput,
  getActiveSystemBannerState,
  getAlertLifecycle,
  buildSystemAlertInsert,
  ALERT_LIFECYCLE_LABELS,
  type SystemAlertInput,
  type SystemAlertRecord,
} from '../../apps/web/src/lib/system-status-helpers'

/**
 * @REQ: SUP-IAM-PANEL
 * @REQ: UI-FOUR-STATES
 *
 * SC-SUP-05 AC (2026-10-26): alert może mieć opcjonalny termin wygaśnięcia. Po terminie znika z banera
 * i z aktywnych, a w historii ma status „Wygasł”. Bez terminu działa jak dotąd — do ręcznego zakończenia.
 */
const NOW = new Date('2026-10-26T12:00:00.000Z')

const input = (expiresAt?: string | null): SystemAlertInput => ({
  title: 'Prace serwisowe',
  message: 'Przerwa techniczna w nocy',
  severity: 'warning',
  status: 'maintenance',
  affectedServices: ['platform'],
  expiresAt,
})

const alert = (over: Partial<SystemAlertRecord> = {}): SystemAlertRecord => ({
  id: 'a1',
  title: 'Prace',
  message: 'Treść',
  severity: 'warning',
  status: 'maintenance',
  affected_services: [],
  is_active: true,
  created_at: '2026-10-26T08:00:00.000Z',
  ...over,
})

describe('Termin wygaśnięcia alertu (@REQ: SUP-IAM-PANEL)', () => {
  it('@REQ: SUP-IAM-PANEL - termin jest opcjonalny, a gdy podany, musi być poprawny i w przyszłości', () => {
    expect(validateSystemAlertInput(input(), NOW).valid).toBe(true)
    expect(validateSystemAlertInput(input(null), NOW).valid).toBe(true)
    expect(validateSystemAlertInput(input(''), NOW).valid).toBe(true)
    expect(validateSystemAlertInput(input('2026-10-27T06:00:00.000Z'), NOW).valid).toBe(true)
    expect(validateSystemAlertInput(input('2026-10-26T11:59:00.000Z'), NOW)).toEqual({ valid: false, error: 'Termin wygaśnięcia musi być w przyszłości.' })
    expect(validateSystemAlertInput(input('nie-data'), NOW)).toEqual({ valid: false, error: 'Nieprawidłowy termin wygaśnięcia.' })
  })

  it('@REQ: SUP-IAM-PANEL - cykl życia: aktywny, wygasł, zakończony', () => {
    expect(getAlertLifecycle(alert(), NOW)).toBe('active')
    expect(getAlertLifecycle(alert({ expires_at: '2026-10-26T13:00:00.000Z' }), NOW)).toBe('active')
    expect(getAlertLifecycle(alert({ expires_at: '2026-10-26T12:00:00.000Z' }), NOW)).toBe('expired')
    expect(getAlertLifecycle(alert({ is_active: false, expires_at: '2026-10-26T10:00:00.000Z' }), NOW)).toBe('resolved')
    expect(ALERT_LIFECYCLE_LABELS).toEqual({ active: 'Aktywny', expired: 'Wygasł', resolved: 'Zakończony' })
  })

  it('@REQ: UI-FOUR-STATES - baner pomija alert po terminie', () => {
    const expired = alert({ id: 'old', severity: 'error', expires_at: '2026-10-26T11:00:00.000Z' })
    const current = alert({ id: 'now', severity: 'info' })
    expect(getActiveSystemBannerState([expired, current], NOW)?.id).toBe('now')
    expect(getActiveSystemBannerState([expired], NOW)).toBeNull()
  })

  it('@REQ: SUP-IAM-PANEL - zapis zawiera termin tylko wtedy, gdy go podano', () => {
    const withExpiry = buildSystemAlertInsert(input('2026-10-27T06:00:00.000Z'), 'u1')
    expect(withExpiry).toMatchObject({ title: 'Prace serwisowe', is_active: true, created_by: 'u1', expires_at: '2026-10-27T06:00:00.000Z' })
    expect(buildSystemAlertInsert(input(), 'u1')).not.toHaveProperty('expires_at')
    expect(buildSystemAlertInsert(input(''), 'u1')).not.toHaveProperty('expires_at')
  })
})
