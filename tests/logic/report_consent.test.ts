import { expect, it, vi } from 'vitest'
import { canNotifyFamilyOfReport } from '@/lib/report-consent'

it.each([null, { revoked_at: '2026-11-25' }, { revoked_at: null }])(
  'wymaga aktywnej zgody na raport w konkretnej placówce @REQ: CONSENT-REVOKE',
  async (data) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    }
    const admin = { from: vi.fn(() => query) }
    const allowed = await canNotifyFamilyOfReport(admin as unknown as Parameters<typeof canNotifyFamilyOfReport>[0], 'org', 'resident')
    expect(query.eq.mock.calls).toEqual([
      ['organization_id', 'org'], ['resident_id', 'resident'], ['purpose', 'family_report_access'],
    ])
    expect(query.order).toHaveBeenNthCalledWith(1, 'granted_at', { ascending: false })
    expect(query.limit).toHaveBeenCalledWith(1)
    expect(allowed).toBe(data?.revoked_at === null)
  },
)
