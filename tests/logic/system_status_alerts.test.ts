import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

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
  publishSystemAlertAction,
  resolveSystemAlertAction,
} from '../../apps/web/src/actions/system-status'

/**
 * @REQ: SUP-IAM-PANEL
 * @REQ: UI-FOUR-STATES
 * @REQ: SEC-AUDIT-APPEND-ONLY
 * @REQ: SEC-NO-PII-LOGS
 * @REQ: MDR-VOCABULARY
 *
 * Testy logiki i akcji serwerowych dla [SC-SUP-05]:
 * Globalne alerty systemowe i status platformy (Wariant A).
 */
describe('SC-SUP-05: System Status & Global Alerts (@REQ: SUP-IAM-PANEL, @REQ: SEC-AUDIT-APPEND-ONLY)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows only non-impersonating super_admin to manage system alerts (@REQ: SUP-IAM-PANEL)', () => {
    expect(canManageSystemAlerts('super_admin', false)).toBe(true)
    expect(canManageSystemAlerts('super_admin', true)).toBe(false)
    expect(canManageSystemAlerts('org_admin', false)).toBe(false)
    expect(canManageSystemAlerts('nurse', false)).toBe(false)
    expect(canManageSystemAlerts('legal_guardian', false)).toBe(false)
    expect(canManageSystemAlerts('family', false)).toBe(false)
    expect(canManageSystemAlerts(undefined, false)).toBe(false)
  })

  it('validates alert input and enforces MDR vocabulary guard (@REQ: MDR-VOCABULARY)', () => {
    const valid = validateSystemAlertInput({
      title: 'Prace serwisowe — transkrypcja głosowa',
      message: 'Pracujemy nad przywróceniem usługi dyktowania notatek dla podopiecznych.',
      severity: 'warning',
      status: 'maintenance',
      affectedServices: ['voice_pipeline'],
    })
    expect(valid.valid).toBe(true)

    const emptyTitle = validateSystemAlertInput({
      title: '  ',
      message: 'Komunikat techniczny',
      severity: 'info',
      status: 'degraded',
      affectedServices: ['platform'],
    })
    expect(emptyTitle.valid).toBe(false)
    expect(emptyTitle.error).toContain('Tytuł')

    const forbiddenWord = validateSystemAlertInput({
      title: 'Problem z kartą pacjenta',
      message: 'Chwilowe utrudnienia w dostępie.',
      severity: 'warning',
      status: 'degraded',
      affectedServices: ['platform'],
    })
    expect(forbiddenWord.valid).toBe(false)
    expect(forbiddenWord.error).toContain('podopieczny')
  })

  it('computes active global banner state for facilities or null when stable (@REQ: UI-FOUR-STATES)', () => {
    const resolvedOnly: SystemAlertRecord[] = [
      {
        id: 'alert-1',
        title: 'Zakończone prace',
        message: 'Wszystko działa.',
        severity: 'info',
        status: 'operational',
        affected_services: ['platform'],
        is_active: false,
        created_at: '2026-10-22T10:00:00Z',
      },
    ]
    expect(getActiveSystemBannerState(resolvedOnly)).toBeNull()

    const withActive: SystemAlertRecord[] = [
      ...resolvedOnly,
      {
        id: 'alert-2',
        title: 'Awaria synchronizacji opasek',
        message: 'Trwają prace nad połączeniem z dostawcą opasek.',
        severity: 'error',
        status: 'degraded',
        affected_services: ['wearables', 'voice_pipeline'],
        is_active: true,
        created_at: '2026-10-22T12:00:00Z',
      },
    ]
    const banner = getActiveSystemBannerState(withActive)
    expect(banner).not.toBeNull()
    expect(banner?.id).toBe('alert-2')
    expect(banner?.serviceLabels).toEqual(['Synchronizacja opasek', 'Potok głosowy (AI)'])
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

  it('rejects publishSystemAlertAction and resolveSystemAlertAction for org_admin (@REQ: SUP-IAM-PANEL)', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'org-admin-1',
              app_metadata: { role: 'org_admin' },
            },
          },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const publishRes = await publishSystemAlertAction({
      title: 'Test',
      message: 'Test opis',
      severity: 'warning',
      status: 'degraded',
      affectedServices: ['platform'],
    })
    expect(publishRes.error).toContain('super_admin')
    expect(publishRes.status).toBe(403)

    const resolveRes = await resolveSystemAlertAction('alert-id-1')
    expect(resolveRes.error).toContain('super_admin')
    expect(resolveRes.status).toBe(403)
  })

  it('publishes and resolves system alert as super_admin with audit trail (@REQ: SUP-IAM-PANEL, @REQ: SEC-AUDIT-APPEND-ONLY)', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'super-admin-1',
              app_metadata: { role: 'super_admin' },
            },
          },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const insertAuditMock = vi.fn().mockResolvedValue({ error: null })
    const insertAlertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'alert-uuid-100',
            title: 'Prace nad potokiem głosowym',
            message: 'Pracujemy nad usługą transkrypcji.',
            severity: 'warning',
            status: 'maintenance',
            affected_services: ['voice_pipeline'],
            is_active: true,
          },
          error: null,
        }),
      }),
    })

    const updateAlertMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'alert-uuid-100',
              severity: 'warning',
              status: 'operational',
              affected_services: ['voice_pipeline'],
              is_active: false,
            },
            error: null,
          }),
        }),
      }),
    })

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'system_alerts') {
          return {
            insert: insertAlertMock,
            update: updateAlertMock,
          }
        }
        if (table === 'audit_logs') {
          return {
            insert: insertAuditMock,
          }
        }
        return {}
      }),
    } as unknown as ReturnType<typeof createAdminClient>)

    const pubRes = await publishSystemAlertAction({
      title: 'Prace nad potokiem głosowym',
      message: 'Pracujemy nad usługą transkrypcji.',
      severity: 'warning',
      status: 'maintenance',
      affectedServices: ['voice_pipeline'],
    })

    expect(pubRes.success).toBe(true)
    expect(insertAlertMock).toHaveBeenCalledTimes(1)
    expect(insertAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SYSTEM_ALERT_PUBLISHED',
        performed_by: 'super-admin-1',
      })
    )

    const resAlert = await resolveSystemAlertAction('alert-uuid-100')
    expect(resAlert.success).toBe(true)
    expect(insertAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SYSTEM_ALERT_RESOLVED',
        performed_by: 'super-admin-1',
      })
    )
  })
})
