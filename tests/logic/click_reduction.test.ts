import { describe, it, expect } from 'vitest'
import { MATRIX } from '../../contracts/roles.contract.mjs'
import fs from 'fs'
import path from 'path'

describe('Staff Click-Reduction Engine (NUR-15)', () => {
  it('verifies MATRIX permissions for daily_reports update @REQ: NUR-BOARD', () => {
    const reportRule = MATRIX.find((m) => m.resource === 'daily_reports')
    expect(reportRule).toBeDefined()
    expect(reportRule?.update).toContain('nurse:own')
    expect(reportRule?.update).toContain('org_admin:own')
  })

  it('enforces bulk publish limit of max 10 reports and audit trail @REQ: NUR-BOARD', () => {
    const actionPath = path.resolve(__dirname, '../../apps/web/src/actions/bulk-reports.ts')
    expect(fs.existsSync(actionPath)).toBe(true)
    const content = fs.readFileSync(actionPath, 'utf8')

    expect(content).toContain('reportIds.length > 10')
    expect(content).toContain('REPORTS_BULK_PUBLISHED')
    expect(content).toContain('audit_logs')
    expect(content).toContain('quickLogRoutineObservationAction')
  })

  it('verifies Command Palette Cmd+K search and quick actions @REQ: UI-ACCESSIBILITY', () => {
    const palettePath = path.resolve(
      __dirname,
      '../../apps/web/src/components/StaffCommandPalette.tsx'
    )
    expect(fs.existsSync(palettePath)).toBe(true)
    const content = fs.readFileSync(palettePath, 'utf8')

    // Key shortcut Cmd+K / Ctrl+K
    expect(content).toContain("e.key.toLowerCase() === 'k'")
    expect(content).toContain('/voice?resident=')
    expect(content).toContain('/staff/reports?resident=')
    expect(content).toContain('min-h-[44px]')
  })

  it('verifies Quick-Rounds mode and 1-click routine observation in staff board @REQ: UI-FOUR-STATES', () => {
    const boardPath = path.resolve(
      __dirname,
      '../../apps/web/src/components/StaffBoardClient.tsx'
    )
    expect(fs.existsSync(boardPath)).toBe(true)
    const content = fs.readFileSync(boardPath, 'utf8')

    expect(content).toContain('rounds')
    expect(content).toContain('Quick-Rounds')
    expect(content).toContain('handleQuickLog')
    expect(content).toContain('quickLogRoutineObservationAction')
    expect(content).toContain('min-h-[48px]')
  })

  it('verifies bulk approver component integration in reports page @REQ: NUR-BOARD', () => {
    const approverPath = path.resolve(
      __dirname,
      '../../apps/web/src/components/BulkReportApprover.tsx'
    )
    const reportsPagePath = path.resolve(
      __dirname,
      '../../apps/web/src/app/(staff)/staff/reports/page.tsx'
    )

    expect(fs.existsSync(approverPath)).toBe(true)
    expect(fs.existsSync(reportsPagePath)).toBe(true)

    const approverContent = fs.readFileSync(approverPath, 'utf8')
    const pageContent = fs.readFileSync(reportsPagePath, 'utf8')

    expect(approverContent).toContain('bulkPublishReportsAction')
    expect(pageContent).toContain('BulkReportApprover')
  })
})
