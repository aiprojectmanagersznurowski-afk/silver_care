import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  canManageSystemAlerts,
  validateSystemAlertInput,
  getActiveSystemBannerState,
  buildSystemAlertAuditPayload,
  formatServiceLabels,
  type SystemAlertRecord,
} from '../../apps/web/src/lib/system-status-helpers'
import {
  getSystemAlertsAction,
  publishSystemAlertAction,
  resolveSystemAlertAction,
} from '../../apps/web/src/actions/system-status'

/**
 * @REQ: SUP-IAM-PANEL
 * @REQ: UI-FOUR-STATES
 * @REQ: SEC-AUDIT-APPEND-ONLY
 * @REQ: SEC-NO-PII-LOGS
 * @REQ: MDR-VOCABULARY
 */
describe('SC-SUP-05: System Status & Global Alerts (@REQ: SUP-IAM-PANEL, @REQ: SEC-AUDIT-APPEND-ONLY)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows only non-impersonating super_admin to manage alerts (@REQ: SUP-IAM-PANEL)', () => {
    expect(canManageSystemAlerts('super_admin', false)).toBe(true)
    expect(canManageSystemAlerts('super_admin', true)).toBe(false)
    expect(canManageSystemAlerts('org_admin', false)).toBe(false)
    expect(canManageSystemAlerts('nurse', false)).toBe(false)
    expect(canManageSystemAlerts(undefined, false)).toBe(false)
  })

  it('validates input, max length, service IDs and MDR vocabulary (@REQ: MDR-VOCABULARY)', () => {
    const valid = validateSystemAlertInput({
      title: 'Prace serwisowe — transkrypcja głosowa',
      message: 'Pracujemy nad przywróceniem usługi dyktowania notatek dla podopiecznych.',
      severity: 'warning',
      status: 'maintenance',
      affectedServices: ['voice_pipeline'],
    })
    expect(valid.valid).toBe(true)

    const longMsg = validateSystemAlertInput({
      title: 'Długi komunikat',
      message: 'A'.repeat(501),
      severity: 'warning',
      status: 'degraded',
      affectedServices: ['platform'],
    })
    expect(longMsg.valid).toBe(false)
    expect(longMsg.error).toContain('500 znaków')

    const invalidSvc = validateSystemAlertInput({
      title: 'Nieznana usługa',
      message: 'Test usługi',
      severity: 'warning',
      status: 'degraded',
      affectedServices: ['invalid_service_id'],
    })
    expect(invalidSvc.valid).toBe(false)
    expect(invalidSvc.error).toContain('nieprawidłową usługę')

    const forbidden = validateSystemAlertInput({
      title: 'Problem z pacjentem',
      message: 'Utrudnienia w dostępie.',
      severity: 'warning',
      status: 'degraded',
      affectedServices: ['platform'],
    })
    expect(forbidden.valid).toBe(false)
    expect(forbidden.error).toContain('podopieczny')
  })

  it('computes active banner state or null when stable (@REQ: UI-FOUR-STATES)', () => {
    const alerts: SystemAlertRecord[] = [{
      id: 'a1',
      title: 'Awaria opasek',
      message: 'Problem z API.',
      severity: 'error',
      status: 'degraded',
      affected_services: ['wearables'],
      is_active: true,
      created_at: '2026-10-22T12:00:00Z',
    }]
    const banner = getActiveSystemBannerState(alerts)
    expect(banner?.id).toBe('a1')
    expect(banner?.serviceLabels).toEqual(['Synchronizacja opasek'])
    expect(formatServiceLabels(['notifications'])).toEqual(['Powiadomienia SMS / E-mail'])
  })

  it('builds zero-PII audit payload for publish and resolve (@REQ: SEC-NO-PII-LOGS, @REQ: SEC-AUDIT-APPEND-ONLY)', () => {
    const payload = buildSystemAlertAuditPayload({
      action: 'SYSTEM_ALERT_PUBLISHED',
      alertId: '11111111-2222-3333-4444-555555555555',
      severity: 'warning',
      status: 'maintenance',
      affectedServices: ['voice_pipeline'],
    })
    expect(payload).toEqual({
      alert_id: '11111111-2222-3333-4444-555555555555',
      event: 'SYSTEM_ALERT_PUBLISHED',
      severity: 'warning',
      status: 'maintenance',
      affected_services: ['voice_pipeline'],
    })
  })

  it('blocks privilege escalation: user_metadata cannot grant super_admin (@REQ: SUP-IAM-PANEL)', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'attacker-1', app_metadata: {}, user_metadata: { role: 'super_admin' } } },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const pubRes = await publishSystemAlertAction({
      title: 'Próba ataku',
      message: 'Treść ataku',
      severity: 'warning',
      status: 'degraded',
      affectedServices: ['platform'],
    })
    expect(pubRes.status).toBe(403)
    expect(pubRes.error).toContain('super_admin')

    const resAlert = await resolveSystemAlertAction('some-alert-id')
    expect(resAlert.status).toBe(403)
  })

  it('restricts getSystemAlertsAction to staff roles and queries via user client (@REQ: SUP-IAM-PANEL)', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'a1', title: 'Prace', message: 'Opis', severity: 'info', status: 'operational', affected_services: [], is_active: true, created_at: '2026-10-22' }],
      error: null,
    })
    const mockFrom = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ order: mockOrder }) })

    // Non-staff (family)
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'fam-1', app_metadata: { role: 'family' } } } }) },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof createClient>>)
    const famRes = await getSystemAlertsAction()
    expect(famRes.alerts).toEqual([])
    expect(famRes.error).toContain('Brak uprawnień')
    expect(mockFrom).not.toHaveBeenCalled()

    // Staff (org_admin)
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1', app_metadata: { role: 'org_admin' } } } }) },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof createClient>>)
    const staffRes = await getSystemAlertsAction()
    expect(staffRes.alerts.length).toBe(1)
    expect(mockFrom).toHaveBeenCalledWith('system_alerts')
  })

  it('publishes and resolves system alert with RLS and zero-PII audit trail (@REQ: SUP-IAM-PANEL, @REQ: SEC-AUDIT-APPEND-ONLY)', async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'uuid-100', title: 'Prace', message: 'Opis', severity: 'warning', status: 'maintenance', affected_services: ['voice_pipeline'], is_active: true },
          error: null,
        }),
      }),
    })
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'uuid-100', severity: 'warning', status: 'operational', affected_services: ['voice_pipeline'], is_active: false },
            error: null,
          }),
        }),
      }),
    })

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'sup-1', app_metadata: { role: 'super_admin' } } } }) },
      from: vi.fn((table: string) => table === 'system_alerts' ? { insert: insertMock, update: updateMock } : {}),
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const auditInsert = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => table === 'audit_logs' ? { insert: auditInsert } : {}),
    } as unknown as ReturnType<typeof createAdminClient>)

    const pubRes = await publishSystemAlertAction({
      title: 'Prace serwisowe',
      message: 'Konserwacja.',
      severity: 'warning',
      status: 'maintenance',
      affectedServices: ['voice_pipeline'],
    })
    expect(pubRes.success).toBe(true)
    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'SYSTEM_ALERT_PUBLISHED',
      performed_by: 'sup-1',
      payload: { alert_id: 'uuid-100', event: 'SYSTEM_ALERT_PUBLISHED', severity: 'warning', status: 'maintenance', affected_services: ['voice_pipeline'] },
    }))

    const resAlert = await resolveSystemAlertAction('uuid-100')
    expect(resAlert.success).toBe(true)
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'SYSTEM_ALERT_RESOLVED',
      performed_by: 'sup-1',
      payload: { alert_id: 'uuid-100', event: 'SYSTEM_ALERT_RESOLVED', severity: 'warning', status: 'operational', affected_services: ['voice_pipeline'] },
    }))
  })
})
