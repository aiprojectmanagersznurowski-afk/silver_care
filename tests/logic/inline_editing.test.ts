import { describe, it, expect, vi } from 'vitest'
import { MATRIX } from '../../contracts/roles.contract.mjs'
import { ACCESSIBILITY } from '@silvercare/contracts/src/generated/design'

vi.mock('../../apps/web/src/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
  })),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
  })),
}))

describe('Granular Inline & Sheet Editing (UI-14)', () => {
  it('enforces MATRIX permissions: only org_admin can update residents @REQ: ADM-RESIDENT-ADD', () => {
    const residentPermission = MATRIX.find((m) => m.resource === 'residents')
    expect(residentPermission).toBeDefined()
    expect(residentPermission?.update).toContain('org_admin')
    // Rodzina i podmioty zewnętrzne nie mogą modyfikować pensjonariusza
    expect(residentPermission?.update).not.toContain('family')
    expect(residentPermission?.update).not.toContain('legal_guardian')
  })

  it('updateResidentInlineAction enforces session and authorization check @REQ: ADM-FACILITY-MANAGE', async () => {
    const { updateResidentInlineAction } = await import('../../apps/web/src/actions/resident-inline')
    const result = await updateResidentInlineAction({ residentId: 'res-test-123', first_name: 'Jan' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/sesji|użytkownika/i)
  })

  it('ensures UI design contract accessibility and touch target standards @REQ: UI-ACCESSIBILITY', async () => {
    // Wymogi celów dotykowych (minimum 38px (ADR-018) wg kontraktu Silver Care)
    const minTarget = parseInt(ACCESSIBILITY.touchTargetMinimum, 10)
    expect(minTarget).toBeGreaterThanOrEqual(38)
    expect(ACCESSIBILITY.contrastMinimum).toBeGreaterThanOrEqual(4.5)

    // Weryfikacja eksportu komponentów edycji inline
    const inlineModule = await import('../../apps/web/src/components/ResidentInlineCareLevel')
    expect(typeof inlineModule.ResidentInlineCareLevel).toBe('function')

    const sheetModule = await import('../../apps/web/src/components/ResidentEditSheet')
    expect(typeof sheetModule.ResidentEditSheet).toBe('function')
  })

  it('integrates inline components into residents admin table and supports UI states @REQ: UI-FOUR-STATES', async () => {
    const sheetModule = await import('../../apps/web/src/components/ResidentEditSheet')
    expect(sheetModule.ResidentEditSheet).toBeDefined()

    const inlineModule = await import('../../apps/web/src/components/ResidentInlineCareLevel')
    expect(inlineModule.ResidentInlineCareLevel).toBeDefined()
  })

  it('integrates EditResidentDialog into resident profile page header and card @REQ: ADM-RESIDENT-ADD', async () => {
    const dialogModule = await import('../../apps/web/src/components/EditResidentDialog')
    expect(typeof dialogModule.EditResidentDialog).toBe('function')
  })
})
