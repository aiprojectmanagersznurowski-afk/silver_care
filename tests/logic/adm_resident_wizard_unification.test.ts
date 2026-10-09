import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('ADM-RESIDENT-WIZARD-UNIFICATION: Unifikacja procesu przyjęcia podopiecznego', () => {
  const pagePath = path.resolve(process.cwd(), 'apps/web/src/app/(admin)/admin/residents/page.tsx')
  const wizardPath = path.resolve(process.cwd(), 'apps/web/src/components/AdmissionWizard.tsx')
  const deprecatedPath = path.resolve(process.cwd(), 'apps/web/src/components/AddResidentDialog.tsx')

  it('kartoteka podopiecznych nie renderuje przestarzałego AddResidentDialog @REQ: ADM-RESIDENT-ADD', () => {
    const pageContent = fs.readFileSync(pagePath, 'utf-8')
    expect(pageContent).not.toMatch(/<AddResidentDialog\s*\/>/)
    expect(pageContent).not.toMatch(/import\s*\{\s*AddResidentDialog\s*\}\s*from/)
  })

  it('kartoteka podopiecznych posiada jedyny kanoniczny AdmissionWizard w pasku akcji @REQ: ADM-RESIDENT-ADD', () => {
    const pageContent = fs.readFileSync(pagePath, 'utf-8')
    expect(pageContent).toMatch(/<AdmissionWizard\s*\/>/)
  })

  it('AdmissionWizard posiada etykietę Nowe Przyjęcie (Kreator) @REQ: ADM-RESIDENT-ADD', () => {
    const wizardContent = fs.readFileSync(wizardPath, 'utf-8')
    expect(wizardContent).toContain('Nowe Przyjęcie (Kreator)')
  })

  it('AdmissionWizard używa słownictwa podopieczny zamiast pensjonariusz @REQ: ADM-RESIDENT-ADD', () => {
    const wizardContent = fs.readFileSync(wizardPath, 'utf-8')
    expect(wizardContent).not.toMatch(/pensjonariusz/i)
    expect(wizardContent).toMatch(/podopieczn/i)
  })

  it('AddResidentDialog jest oznaczony jako przestarzały (@deprecated) @REQ: ADM-RESIDENT-ADD', () => {
    const deprecatedContent = fs.readFileSync(deprecatedPath, 'utf-8')
    expect(deprecatedContent).toContain('@deprecated')
  })
})
