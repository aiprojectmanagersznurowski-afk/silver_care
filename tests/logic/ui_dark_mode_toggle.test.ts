import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 *
 * Testy logiki i modułów przełącznika trybu ciemnego (UI-DARK-MODE-TOGGLE).
 */

const ROOT = path.resolve(__dirname, '../..');
const WEB_SRC = path.join(ROOT, 'apps/web/src');

describe('Logika przełączania motywu (Dark Mode) @REQ: UI-TEMPLATE-ALIGNMENT', () => {
  it('moduł logiki motywu eksportuje stałe i funkcje pomocnicze @REQ: UI-TEMPLATE-ALIGNMENT', async () => {
    const themeModule = await import('../../apps/web/src/lib/theme');
    
    expect(themeModule.THEME_STORAGE_KEY).toBe('sc-theme');
    expect(themeModule.THEMES).toEqual(['light', 'dark', 'system']);
    expect(typeof themeModule.resolveTheme).toBe('function');
    expect(typeof themeModule.getAntiFOUCScript).toBe('function');
  });

  it('resolveTheme poprawnie wylicza aktywny motyw dla preferencji użytkownika i systemu @REQ: UI-TEMPLATE-ALIGNMENT', async () => {
    const { resolveTheme } = await import('../../apps/web/src/lib/theme');

    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');

    // system resolution
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
  });

  it('skrypt anty-FOUC zawiera odczyt z localStorage i obsługę klasy dark @REQ: UI-TEMPLATE-ALIGNMENT', async () => {
    const { getAntiFOUCScript, THEME_STORAGE_KEY } = await import('../../apps/web/src/lib/theme');
    const script = getAntiFOUCScript();

    expect(script).toContain(THEME_STORAGE_KEY);
    expect(script).toContain("document.documentElement.classList.add('dark')");
    expect(script).toContain("document.documentElement.classList.remove('dark')");
    expect(script).toContain("prefers-color-scheme: dark");
  });

  it('komponent ThemeToggle istnieje i zawiera atrybuty dostępności WCAG @REQ: UI-ACCESSIBILITY', () => {
    const togglePath = path.join(WEB_SRC, 'components/ThemeToggle.tsx');
    expect(fs.existsSync(togglePath)).toBe(true);

    const content = fs.readFileSync(togglePath, 'utf-8');
    expect(content).toContain('aria-label');
    expect(content).toContain('lucide-react');
  });

  it('komponent ThemeProvider istnieje i zarządza kontekstem motywu @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const providerPath = path.join(WEB_SRC, 'components/ThemeProvider.tsx');
    expect(fs.existsSync(providerPath)).toBe(true);

    const content = fs.readFileSync(providerPath, 'utf-8');
    expect(content).toContain('useTheme');
    expect(content).toContain('ThemeProvider');
  });
});
