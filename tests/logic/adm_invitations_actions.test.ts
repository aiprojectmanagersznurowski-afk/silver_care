import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('ADM-INVITATIONS-ACTIONS-MANAGEMENT: Rejestr zaproszeń i akcje', () => {
  const dialogPath = path.resolve(process.cwd(), 'apps/web/src/components/InviteFamilyDialog.tsx')
  const profilePath = path.resolve(process.cwd(), 'apps/web/src/app/(admin)/admin/residents/[id]/page.tsx')
  const invitationsPagePath = path.resolve(process.cwd(), 'apps/web/src/app/(admin)/admin/invitations/page.tsx')
  const apiRoutePath = path.resolve(process.cwd(), 'apps/web/src/app/api/family/invite/route.ts')

  it('InviteFamilyDialog używa słowa podopieczny zamiast pensjonariusz @REQ: ADM-INVITE', () => {
    const dialogContent = fs.readFileSync(dialogPath, 'utf-8')
    expect(dialogContent).not.toMatch(/pensjonariusz/i)
    expect(dialogContent).toMatch(/podopieczn/i)
  })

  it('InviteFamilyDialog obsługuje defaultResidentId oraz opcjonalny triggerLabel @REQ: ADM-INVITE', () => {
    const dialogContent = fs.readFileSync(dialogPath, 'utf-8')
    expect(dialogContent).toMatch(/defaultResidentId/i)
    expect(dialogContent).toMatch(/triggerLabel/i)
  })

  it('profil seniora integruje bezpośredni skrót zaproszenia bliskiego w sekcji Bliscy @REQ: ADM-INVITE', () => {
    const profileContent = fs.readFileSync(profilePath, 'utf-8')
    expect(profileContent).toContain('InviteFamilyDialog')
    expect(profileContent).toContain('triggerLabel="Zaproś bliskiego"')
  })

  it('strona lub komponent zaproszeń zawiera kolumnę Akcje oraz operacje ponów, kopiuj i odwołaj @REQ: ADM-INVITE', () => {
    const tablePath = path.resolve(process.cwd(), 'apps/web/src/components/InvitationsTable.tsx')
    expect(fs.existsSync(tablePath)).toBe(true)
    const tableContent = fs.readFileSync(tablePath, 'utf-8')
    expect(tableContent).toMatch(/Akcje/i)
    expect(tableContent).toMatch(/Kopiuj link/i)
    expect(tableContent).toMatch(/Odwołaj/i)
    expect(tableContent).toMatch(/Ponów/i)
  })

  it('endpoint API family/invite obsługuje metodę PATCH do revoke i resend @REQ: ADM-INVITE', () => {
    const apiContent = fs.readFileSync(apiRoutePath, 'utf-8')
    expect(apiContent).toMatch(/export\s+async\s+function\s+PATCH/)
  })
})
