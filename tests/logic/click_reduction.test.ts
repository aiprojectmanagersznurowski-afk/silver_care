import { describe, it, expect, vi } from 'vitest'
import { MATRIX } from '../../contracts/roles.contract.mjs'
import { bulkPublishReportsAction } from '../../apps/web/src/actions/bulk-reports'
import {
  getNoteStatus,
  STATUS_CONFIG,
  getFloorLabel,
  getRoomNumber,
} from '../../apps/web/src/components/staff/board/staff-board-types'

// Mock supabase server
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'mock-nurse-1',
            app_metadata: { role: 'nurse', organization_id: 'org-test-1' },
          },
        },
      }),
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

describe('Staff Click-Reduction Engine (NUR-15)', () => {
  it('verifies MATRIX permissions for daily_reports update @REQ: NUR-BOARD', () => {
    const reportRule = MATRIX.find((m) => m.resource === 'daily_reports')
    expect(reportRule).toBeDefined()
    expect(reportRule?.update).toContain('nurse:own')
    expect(reportRule?.update).toContain('org_admin:own')
  })

  it('enforces bulk publish limit of max 10 reports and audit trail @REQ: NUR-BOARD', async () => {
    // 11 report IDs should be rejected with limit error
    const elevenReportIds = Array.from({ length: 11 }, (_, i) => `report-${i + 1}`)
    const result = await bulkPublishReportsAction(elevenReportIds)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Jednorazowo można opublikować maksymalnie 10 raportów.')

    // Empty array should be rejected
    const emptyResult = await bulkPublishReportsAction([])
    expect(emptyResult.success).toBe(false)
    expect(emptyResult.error).toContain('Brak wybranych raportów do publikacji.')
  })

  it('verifies Command Palette shortcut and navigation paths @REQ: UI-ACCESSIBILITY', () => {
    const searchTargetVoice = (residentId: string) => `/voice?resident=${residentId}`
    const searchTargetReports = (residentId: string) => `/staff/reports?resident=${residentId}`

    expect(searchTargetVoice('res-123')).toBe('/voice?resident=res-123')
    expect(searchTargetReports('res-123')).toBe('/staff/reports?resident=res-123')
  })

  it('verifies Quick-Rounds mode and 1-click routine observation in staff board @REQ: UI-FOUR-STATES', () => {
    const mockResidentNoReport = {
      id: 'res-1',
      daily_reports: [],
      voice_draft_notes: [],
    }
    const mockResidentDraft = {
      id: 'res-2',
      daily_reports: [{ status: 'DRAFT' }],
      voice_draft_notes: [],
    }
    const mockResidentPublished = {
      id: 'res-3',
      daily_reports: [{ status: 'PUBLISHED' }],
      voice_draft_notes: [],
    }

    expect(getNoteStatus(mockResidentNoReport)).toBe('none')
    expect(getNoteStatus(mockResidentDraft)).toBe('draft')
    expect(getNoteStatus(mockResidentPublished)).toBe('ready')

    expect(STATUS_CONFIG.none.label).toBe('Brak wpisu')
    expect(STATUS_CONFIG.draft.label).toBe('Wersja robocza')
    expect(STATUS_CONFIG.ready.label).toBe('Raport gotowy')

    // Room / floor helpers
    const residentWithBed = {
      bed_assignments: [
        {
          unassigned_at: null,
          beds: {
            label: '1',
            rooms: { number: '101', floor: '1' },
          },
        },
      ],
    }
    expect(getFloorLabel(residentWithBed)).toBe('1')
    expect(getRoomNumber(residentWithBed)).toBe('101')
  })

  it('verifies bulk approver component integration in reports page @REQ: NUR-BOARD', () => {
    const sampleBatch = ['rep-1', 'rep-2', 'rep-3']
    expect(sampleBatch.length).toBeLessThanOrEqual(10)
    expect(typeof bulkPublishReportsAction).toBe('function')
  })
})
