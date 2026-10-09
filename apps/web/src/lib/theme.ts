/**
 * Logika i definicje dla przełącznika trybu ciemnego (UI-DARK-MODE-TOGGLE).
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 */

export const THEME_STORAGE_KEY = 'sc-theme';

export const THEMES = ['light', 'dark', 'system'] as const;

export type Theme = (typeof THEMES)[number];

export type ResolvedTheme = 'light' | 'dark';

/**
 * Rozstrzyga ostateczny motyw (light/dark) na podstawie preferencji użytkownika
 * oraz stanu systemowego prefers-color-scheme.
 */
export function resolveTheme(
  preference: Theme,
  systemPrefersDark: boolean
): ResolvedTheme {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return systemPrefersDark ? 'dark' : 'light';
}

/**
 * Zwraca skrypt inline do wstrzyknięcia w <head> w celu wyeliminowania
 * efektu białego błysku (Flash of Unstyled Content - FOUC).
 */
export function getAntiFOUCScript(): string {
  return `(function() {
    try {
      var key = '${THEME_STORAGE_KEY}';
      var stored = localStorage.getItem(key);
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = stored === 'dark' || ((!stored || stored === 'system') && prefersDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })();`;
}
