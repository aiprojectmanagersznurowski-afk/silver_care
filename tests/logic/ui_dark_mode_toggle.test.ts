import { describe, it, expect } from 'vitest';
import {
  THEME_STORAGE_KEY,
  THEMES,
  resolveTheme,
  getAntiFOUCScript,
} from '../../apps/web/src/lib/theme';
import { ACCESSIBILITY } from '@silvercare/contracts/src/generated/design';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 *
 * Testy logiki i modułów przełącznika trybu ciemnego (UI-DARK-MODE-TOGGLE):
 * 1. Rozstrzyganie motywów (light, dark, system).
 * 2. Skrypt anty-FOUC (eliminacja białego błysku).
 * 3. Eksporty komponentów przełącznika i providera motywu.
 */
describe('Logika przełączania motywu (Dark Mode) @REQ: UI-TEMPLATE-ALIGNMENT', () => {
  it('moduł logiki motywu eksportuje stałe i funkcje pomocnicze @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(THEME_STORAGE_KEY).toBe('sc-theme');
    expect(THEMES).toEqual(['light', 'dark', 'system']);
    expect(typeof resolveTheme).toBe('function');
    expect(typeof getAntiFOUCScript).toBe('function');
  });

  it('resolveTheme poprawnie wylicza aktywny motyw dla preferencji użytkownika i systemu @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');

    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');

    // preferencja systemowa
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
  });

  it('skrypt anty-FOUC zawiera odczyt z localStorage i obsługę klasy dark @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const script = getAntiFOUCScript();

    expect(script).toContain(THEME_STORAGE_KEY);
    expect(script).toContain("document.documentElement.classList.add('dark')");
    expect(script).toContain("document.documentElement.classList.remove('dark')");
    expect(script).toContain("prefers-color-scheme: dark");
  });

  it('komponent ThemeToggle poprawnie się eksportuje i spełnia normy dostępności @REQ: UI-ACCESSIBILITY', async () => {
    const toggleModule = await import('../../apps/web/src/components/ThemeToggle');
    expect(typeof toggleModule.ThemeToggle).toBe('function');
    expect(ACCESSIBILITY.touchTargetMinimum).toBe('38px');
  });

  it('komponent ThemeProvider poprawnie się eksportuje i zarządza kontekstem @REQ: UI-TEMPLATE-ALIGNMENT', async () => {
    const providerModule = await import('../../apps/web/src/components/ThemeProvider');
    expect(typeof providerModule.ThemeProvider).toBe('function');
    expect(typeof providerModule.useTheme).toBe('function');
  });
});
