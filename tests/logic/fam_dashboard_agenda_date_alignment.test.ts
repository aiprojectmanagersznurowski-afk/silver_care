import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('FAM-DASHBOARD-AGENDA-DATE-ALIGNMENT: Spójność dat i kategorii agendy', () => {
  const heroPath = path.resolve(process.cwd(), 'apps/web/src/components/DailySummaryHero.tsx')
  const clientPath = path.resolve(process.cwd(), 'apps/web/src/components/FamilyDashboardClient.tsx')
  const timelinePath = path.resolve(process.cwd(), 'apps/web/src/components/AgendaTimelineClient.tsx')
  const deadSwitcherPath = path.resolve(process.cwd(), 'apps/web/src/components/ResidentSwitcher.tsx')
  const deadAgendaViewPath = path.resolve(process.cwd(), 'apps/web/src/components/AgendaView.tsx')

  it('DailySummaryHero obsługuje selectedDate i dynamiczne etykiety Dzisiaj/Wczoraj/data @REQ: FAM-DASHBOARD', () => {
    const heroContent = fs.readFileSync(heroPath, 'utf-8')
    expect(heroContent).toMatch(/selectedDate\??:\s*(string|Date)/)
    expect(heroContent).toMatch(/Wczoraj/)
  })

  it('FamilyDashboardClient przekazuje selectedDate do DailySummaryHero @REQ: FAM-DASHBOARD', () => {
    const clientContent = fs.readFileSync(clientPath, 'utf-8')
    expect(clientContent).toMatch(/<DailySummaryHero[\s\S]*selectedDate=\{selectedDate\}/)
  })

  it('AgendaTimelineClient uwzględnia pole type z modelu danych @REQ: FAM-AGENDA', () => {
    const timelineContent = fs.readFileSync(timelinePath, 'utf-8')
    expect(timelineContent).toMatch(/type\??:\s*string/)
    expect(timelineContent).toMatch(/item\.type|type/i)
  })

  it('martwe komponenty ResidentSwitcher i AgendaView zostały usunięte @REQ: FAM-DASHBOARD', () => {
    expect(fs.existsSync(deadSwitcherPath)).toBe(false)
    expect(fs.existsSync(deadAgendaViewPath)).toBe(false)
  })
})
