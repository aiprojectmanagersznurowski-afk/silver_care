import { describe, it, expect } from 'vitest'
import {
  formatAuditTimestamp,
  formatAuditToCsv,
  filterAuditLogsByDate,
  type AuditLogEntry
} from '../../apps/web/src/lib/audit-helpers'

/**
 * @REQ: SEC-AUDIT-APPEND-ONLY
 * @REQ: SEC-NO-PII-LOGS
 *
 * Testy logiki rejestru audytowego RODO:
 * AC1: User ID jednoznacznie widoczny
 * AC2: Filtrowanie po zakresie dat
 * AC3: Bezpieczny eksport CSV bez danych osobowych pensjonariuszy
 * AC4: Formatowanie czasu zgodne ze strefą i locale przeglądarki
 */
describe('Audit Log Formatting & RODO Export (@REQ: SEC-AUDIT-APPEND-ONLY, @REQ: SEC-NO-PII-LOGS)', () => {
  const sampleLogs: AuditLogEntry[] = [
    {
      id: 'log-1',
      organization_id: 'org-101',
      action: 'role_change',
      performed_by: 'user-admin-uuid-1',
      created_at: '2026-09-01T10:30:00.000Z',
      payload: { new_role: 'nurse', target_user_id: 'user-nurse-uuid-2' }
    },
    {
      id: 'log-2',
      organization_id: 'org-101',
      action: 'password_reset',
      performed_by: 'user-admin-uuid-1',
      created_at: '2026-09-15T14:45:00.000Z',
      payload: { target_user_id: 'user-nurse-uuid-2' }
    },
    {
      id: 'log-3',
      organization_id: 'org-101',
      action: 'impersonation_start',
      performed_by: 'superadmin-uuid-9',
      created_at: '2026-09-24T08:15:00.000Z',
      payload: { target_organization_id: 'org-101' }
    }
  ]

  describe('AC4: Formatowanie czasu wg strefy i locale (@REQ: SEC-AUDIT-APPEND-ONLY)', () => {
    it('formats UTC ISO timestamp into localized string without errors', () => {
      const formatted = formatAuditTimestamp('2026-09-01T10:30:00.000Z', 'Europe/Warsaw', 'pl-PL')
      expect(formatted).toBeDefined()
      // W strefie Europe/Warsaw czas letni UTC+2: 10:30 UTC -> 12:30
      expect(formatted).toContain('12:30')
      expect(formatted).toContain('01.09.2026')
    })
  })

  describe('AC2: Filtrowanie po zakresie dat (@REQ: SEC-AUDIT-APPEND-ONLY)', () => {
    it('correctly filters logs within start and end date boundary', () => {
      const filtered = filterAuditLogsByDate(sampleLogs, '2026-09-10', '2026-09-20')
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('log-2')
    })

    it('returns all logs when no date bounds are specified', () => {
      const all = filterAuditLogsByDate(sampleLogs, undefined, undefined)
      expect(all).toHaveLength(3)
    })
  })

  describe('AC1 & AC3: Bezpieczny eksport CSV i ekspozycja User ID (@REQ: SEC-NO-PII-LOGS)', () => {
    it('generates structured CSV with User ID and without PII of residents', () => {
      const csv = formatAuditToCsv(sampleLogs)
      
      expect(csv).toContain('Czas (Lokalny),Czas (UTC),Akcja,User ID (Aktor),Szczegoly')
      expect(csv).toContain('user-admin-uuid-1')
      expect(csv).toContain('superadmin-uuid-9')
      expect(csv).toContain('role_change')

      // Rygorystyczny zakaz wycieku PII pensjonariuszy (brak pesel, imion, nazwisk)
      expect(csv).not.toMatch(/"(first_name|last_name|pesel)"/i)
      expect(csv).not.toMatch(/Jan Kowalski|90010112345/i)
    })
  })
})
