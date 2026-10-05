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

  it('@REQ: UI-FOUR-STATES - motyw zachowuje kanoniczną paletę Silver Care (Ciepłe Zaufanie) przez tokeny kontraktu', () => {
    // ADR-014: wartości kolorów żyją w kontrakcie (tokens.css), globals.css tylko je mapuje.
    const tokens = readFileSync(join(root, 'packages/contracts/src/generated/tokens.css'), 'utf8')
    expect(tokens).toContain('--sc-accent: #2F6F5E')
    expect(tokens).toContain('--sc-bg: #FBFAF8')
    expect(tokens).toContain('--sc-text: #1C1B19')
    expect(tokens).toContain('--sc-border: #E8E4DD')

    const cssContent = readFileSync(join(root, 'apps/web/src/app/globals.css'), 'utf8')
    expect(cssContent).toContain('--primary: var(--sc-accent)')
    expect(cssContent).toContain('--background: var(--sc-bg)')
    expect(cssContent).toContain('--foreground: var(--sc-text)')
    expect(cssContent).toContain('--border: var(--sc-border)')
    expect(cssContent).toContain('--sidebar')
  })

  it('@REQ: SEC-SESSION - auth/callback i login/page.tsx poprawnie kierują role i obsługują błędy OAuth', () => {
    const callbackPath = join(root, 'apps/web/src/app/auth/callback/route.ts')
    expect(existsSync(callbackPath)).toBe(true)
    const callbackContent = readFileSync(callbackPath, 'utf8')

    // Weryfikacja kierowania ról z app_metadata (RBAC)
    expect(callbackContent).toContain("role === 'super_admin'")
    expect(callbackContent).toContain("destination = '/admin'")
    expect(callbackContent).toContain("destination = '/staff'")
    expect(callbackContent).toContain("destination = '/dashboard'")
    expect(callbackContent).toContain('response.cookies.set')

    // Weryfikacja obsługi parametru błędu na stronie logowania
    const loginPath = join(root, 'apps/web/src/app/login/page.tsx')
    const loginContent = readFileSync(loginPath, 'utf8')
    expect(loginContent).toContain("searchParams.get('error')")
  })
})

