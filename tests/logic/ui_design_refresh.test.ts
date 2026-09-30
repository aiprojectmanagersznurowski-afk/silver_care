import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * @REQ: UI-ACCESSIBILITY
 * @REQ: UI-FOUR-STATES
 *
 * Testy weryfikujące wdrożenie odświeżonego systemu projektowego (shadcn)
 * oraz spójność komponentów i strony logowania.
 */
describe('UI Design System Refresh & Login Page', () => {
  const root = process.cwd()

  it('@REQ: UI-ACCESSIBILITY - Komponenty UI shadcn posiadają wymagane pliki i eksporty', async () => {
    const requiredComponents = [
      'apps/web/src/components/ui/checkbox.tsx',
      'apps/web/src/components/ui/skeleton.tsx',
      'apps/web/src/components/ui/breadcrumb.tsx',
      'apps/web/src/components/ui/tooltip.tsx',
    ]

    for (const compPath of requiredComponents) {
      const fullPath = join(root, compPath)
      expect(existsSync(fullPath), `Plik ${compPath} powinien istnieć`).toBe(true)
    }
  })

  it('@REQ: UI-ACCESSIBILITY - Strona logowania zawiera kluczowe elementy interaktywne i zachowuje selektory E2E', () => {
    const loginPath = join(root, 'apps/web/src/app/login/page.tsx')
    expect(existsSync(loginPath)).toBe(true)

    const content = readFileSync(loginPath, 'utf8')

    // Wymogi wizualne z 21st.dev (login_template.md)
    expect(content).toContain('canvasRef')
    expect(content).toContain('accent-lines')
    expect(content).toContain('card-animate')

    // Wymogi funkcjonalne i selektory E2E
    expect(content).toContain('id="email"')
    expect(content).toContain('id="password"')
    expect(content).toContain('type="submit"')
    expect(content).toContain('Zaloguj się')
    expect(content).toContain('Zaloguj z Google')
    expect(content).toContain('text-destructive')
    expect(content).toContain('alt="Silver Care"')
    expect(content).toContain('signInWithPassword')
    expect(content).toContain('signInWithOAuth')
  })

  it('@REQ: UI-FOUR-STATES - globals.css zachowuje kanoniczną paletę Silver Care (Ciepłe Zaufanie)', () => {
    const cssPath = join(root, 'apps/web/src/app/globals.css')
    const cssContent = readFileSync(cssPath, 'utf8')

    // Kanoniczne wartości kolorów Silver Care
    expect(cssContent).toContain('--primary: #2F6F5E')
    expect(cssContent).toContain('--background: #FBFAF8')
    expect(cssContent).toContain('--foreground: #1C1B19')
    expect(cssContent).toContain('--border: #E8E4DD')
    expect(cssContent).toContain('--sidebar')
  })
})
