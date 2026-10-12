import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { validateDailyLogData } from '../../apps/web/src/lib/daily-logs-schema'

describe('UI Wizard, Quick Rounds & Accessibility Fixes (UI-WIZARD-ROUNDS-A11Y-FIX)', () => {
  it('verifies quickLogRoutineObservationAction daily_logs schema compatibility @REQ: NUR-BOARD', () => {
    const actionPath = path.resolve(__dirname, '../../apps/web/src/actions/bulk-reports.ts')
    expect(fs.existsSync(actionPath)).toBe(true)
    const content = fs.readFileSync(actionPath, 'utf8')

    // Must target daily_logs with correct schema
    expect(content).toContain(".from('daily_logs')")
    expect(content).toContain('resident_id: residentId')
    expect(content).toContain('nurse_id: user.id')
    expect(content).toContain('data:')

    // Must NOT contain illegal columns that do not exist on daily_logs
    expect(content).not.toMatch(/daily_logs[\s\S]*?organization_id:\s*resident\.organization_id/)
    expect(content).not.toMatch(/daily_logs[\s\S]*?author_id:\s*user\.id/)
    expect(content).not.toMatch(/daily_logs[\s\S]*?activity_type:/)
    expect(content).not.toMatch(/daily_logs[\s\S]*?notes:\s*summary/)

    // Structure of data object must validate with validateDailyLogData
    const sampleRoundPayload = {
      action: 'ROUTINE_OBSERVATION',
      note: 'Stan stabilny, podopieczny spokojny, bez uwag.',
      behavioral_items: ['Stan stabilny, podopieczny spokojny, bez uwag.'],
      source: 'quick_rounds_1click',
      recorded_at: new Date().toISOString(),
    }
    const valResult = validateDailyLogData(sampleRoundPayload)
    expect(valResult.valid).toBe(true)
  })

  it('verifies AdmissionWizard success header resolution and no step 3 mismatch @REQ: ADM-RESIDENT-ADD', () => {
    const wizardPath = path.resolve(__dirname, '../../apps/web/src/components/AdmissionWizard.tsx')
    expect(fs.existsSync(wizardPath)).toBe(true)
    const content = fs.readFileSync(wizardPath, 'utf8')

    // Must conditionally render header for success state
    expect(content).toContain('createdResidentId')
    expect(content).toMatch(/createdResidentId\s*\?\s*\(?[\s\S]*?Przyjęcie podopiecznego zakończone/)
    expect(content).not.toMatch(/DialogTitle[^>]*>[^<]*Krok \{step\} z 3[\s\S]*?createdResidentId/i)
  })

  it('enforces semantic buttons and keyboard focus on bed selection candidates @REQ: UI-ACCESSIBILITY', () => {
    const wizardPath = path.resolve(__dirname, '../../apps/web/src/components/AdmissionWizard.tsx')
    const content = fs.readFileSync(wizardPath, 'utf8')

    // Bed suggestions must be <button type="button"> or have role="button" with keyboard focus
    expect(content).toMatch(/<button[\s\S]*?key=\{s\.bedId\}[\s\S]*?type="button"/)
    expect(content).toContain('focus-visible')
  })

  it('eliminates hardcoded text-white on primary accents in AdmissionWizard for dark mode contrast @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const wizardPath = path.resolve(__dirname, '../../apps/web/src/components/AdmissionWizard.tsx')
    const content = fs.readFileSync(wizardPath, 'utf8')

    // Buttons must NOT combine bg-primary with text-white
    expect(content).not.toMatch(/bg-primary[^"]*text-white/)
    expect(content).not.toMatch(/buttonVariants\([^)]*text-white/)
  })
})
