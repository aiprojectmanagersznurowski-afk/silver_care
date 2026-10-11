import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('FAM-DASHBOARD-AGENDA-DATE-ALIGNMENT: Spójność dat i kategorii agendy', () => {
  const heroPath = path.resolve(process.cwd(), 'apps/web/src/components/DailySummaryHero.tsx')
  const clientPath = path.resolve(process.cwd(), 'apps/web/src/components/FamilyDashboardClient.tsx')
  const timelinePath = path.resolve(process.cwd(), 'apps/web/src/components/AgendaTimelineClient.tsx')
  const deprecatedSwitcherPath = path.resolve(process.cwd(), 'apps/web/src/components/ResidentSwitcher.tsx')
  const deprecatedAgendaViewPath = path.resolve(process.cwd(), 'apps/web/src/components/AgendaView.tsx')

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

  it('martwe komponenty ResidentSwitcher i AgendaView są wycofane i oznaczone @deprecated @REQ: FAM-DASHBOARD', () => {
    const switcherContent = fs.readFileSync(deprecatedSwitcherPath, 'utf-8')
    const agendaViewContent = fs.readFileSync(deprecatedAgendaViewPath, 'utf-8')
    expect(switcherContent).toContain('@deprecated')
    expect(agendaViewContent).toContain('@deprecated')
  })
})
