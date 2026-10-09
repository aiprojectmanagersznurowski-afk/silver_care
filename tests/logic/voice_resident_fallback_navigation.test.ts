import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('VOICE-RESIDENT-FALLBACK-NAVIGATION: Nawigacja i fallback wyboru podopiecznego', () => {
  const sidebarPath = path.resolve(process.cwd(), 'apps/web/src/components/StaffSidebar.tsx')
  const voicePagePath = path.resolve(process.cwd(), 'apps/web/src/app/(staff)/voice/page.tsx')

  it('StaffSidebar zawiera odnośnik do Notatki głosowej w grupie Dyżur @REQ: VOICE-ZERO-GUESSING', () => {
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8')
    expect(sidebarContent).toContain("href: '/voice'")
    expect(sidebarContent).toContain("label: 'Notatka głosowa'")
  })

  it('ekran notatki głosowej posiada widoczny przycisk powrotu do tablicy dyżuru @REQ: VOICE-ZERO-GUESSING', () => {
    const voiceContent = fs.readFileSync(voicePagePath, 'utf-8')
    expect(voiceContent).toContain('Wróć do tablicy dyżuru')
    expect(voiceContent).toContain("href=\"/staff\"")
  })

  it('ekran notatki głosowej w przypadku braku parametru resident udostępnia wybór/wyszukiwarkę podopiecznych @REQ: VOICE-ZERO-GUESSING', () => {
    const voiceContent = fs.readFileSync(voicePagePath, 'utf-8')
    expect(voiceContent).not.toContain('Brak ID podopiecznego. Wróć do tablicy.')
    expect(voiceContent).toMatch(/Wybierz podopiecznego|Szukaj podopiecznego/i)
  })
})
