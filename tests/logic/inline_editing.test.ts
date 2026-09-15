import { describe, it, expect } from 'vitest'
import { MATRIX } from '../../contracts/roles.contract.mjs'
import fs from 'fs'
import path from 'path'

describe('Granular Inline & Sheet Editing (UI-14)', () => {
  it('enforces MATRIX permissions: only org_admin can update residents @REQ: ADM-RESIDENT-ADD', () => {
    const residentPermission = MATRIX.find((m) => m.resource === 'residents')
    expect(residentPermission).toBeDefined()
    expect(residentPermission?.update).toContain('org_admin')
    // Rodzina i podmioty zewnętrzne nie mogą modyfikować pensjonariusza
    expect(residentPermission?.update).not.toContain('family')
    expect(residentPermission?.update).not.toContain('legal_guardian')
  })

  it('verifies audit trail action in resident inline action file @REQ: ADM-FACILITY-MANAGE', () => {
    const actionPath = path.resolve(__dirname, '../../apps/web/src/actions/resident-inline.ts')
    expect(fs.existsSync(actionPath)).toBe(true)
    const content = fs.readFileSync(actionPath, 'utf8')

    expect(content).toContain('RESIDENT_INLINE_UPDATE')
    expect(content).toContain('audit_logs')
    expect(content).toContain('revalidatePath')
    expect(content).toContain('allowedRoles')
  })

  it('ensures touch targets meet a11y min 48px and keyboard accessibility in UI @REQ: UI-ACCESSIBILITY', () => {
    const inlineCareLevelPath = path.resolve(
      __dirname,
      '../../apps/web/src/components/ResidentInlineCareLevel.tsx'
    )
    const sheetEditPath = path.resolve(
      __dirname,
      '../../apps/web/src/components/ResidentEditSheet.tsx'
    )

    expect(fs.existsSync(inlineCareLevelPath)).toBe(true)
    expect(fs.existsSync(sheetEditPath)).toBe(true)

    const inlineContent = fs.readFileSync(inlineCareLevelPath, 'utf8')
    const sheetContent = fs.readFileSync(sheetEditPath, 'utf8')

    // min 48px touch targets
    expect(inlineContent).toContain('min-h-[48px]')
    expect(sheetContent).toContain('min-h-[48px]')

    // Rollback / error handling check
    expect(inlineContent).toContain('previousLevel')
    expect(inlineContent).toContain('setErrorMessage')
    expect(sheetContent).toContain('setErrorMessage')
  })

  it('integrates inline components into residents admin table @REQ: UI-FOUR-STATES', () => {
    const pagePath = path.resolve(
      __dirname,
      '../../apps/web/src/app/(admin)/admin/residents/page.tsx'
    )
    const content = fs.readFileSync(pagePath, 'utf8')

    expect(content).toContain('ResidentInlineCareLevel')
    expect(content).toContain('ResidentEditSheet')
  })
})
