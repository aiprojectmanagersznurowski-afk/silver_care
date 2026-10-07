import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('UI-NUR-AGENDA-TOAST: Podpięcie powiadomień toast (Sonner) w Planerze Dnia Personelu', () => {
  const pagePath = path.resolve(process.cwd(), 'apps/web/src/app/(staff)/staff/agenda/page.tsx')
  const content = fs.readFileSync(pagePath, 'utf-8')

  it('powinien importować toast z biblioteki sonner @REQ: NUR-AGENDA', () => {
    expect(content).toMatch(/import\s*\{\s*toast\s*\}\s*from\s*['"]sonner['"]/)
  })

  it('nie powinien posiadać zamockowanego obiektu toast opartego na console.log @REQ: NUR-AGENDA', () => {
    expect(content).not.toMatch(/const\s+toast\s*=\s*\{\s*success:/)
  })

  it('powinien wyświetlać dedykowany toast sukcesu po dodaniu pozycji @REQ: NUR-AGENDA', () => {
    expect(content).toContain("toast.success('Wydarzenie zostało dodane do harmonogramu.')")
  })

  it('powinien wyświetlać toast sukcesu po edycji pozycji @REQ: NUR-AGENDA', () => {
    expect(content).toContain("toast.success('Zaktualizowano wpis w harmonogramie.')")
  })

  it('powinien wyświetlać toast sukcesu po usunięciu pozycji @REQ: NUR-AGENDA', () => {
    expect(content).toContain("toast.success('Usunięto wpis z harmonogramu.')")
  })
})
