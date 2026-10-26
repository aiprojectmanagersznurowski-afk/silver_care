import { test, expect } from '../fixtures/base-test';
import { DailyReportPage } from '../page-objects/DailyReportPage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * „Dane dzienne”: przyklejona pierwsza kolumna ma nieprzezroczyste tło także w wyróżnionych wierszach
 * i w nagłówku — przy przewijaniu w poziomie nie prześwitują przez nią inne kolumny (zgłoszenie Michała 2026-10-26).
 */
function isOpaque(color: string): boolean {
  if (color === 'transparent') return false;
  const rgba = color.match(/^rgba\(\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*([\d.]+)\s*\)$/);
  if (rgba) return Number(rgba[1]) >= 1;
  const slash = color.match(/\/\s*([\d.]+%?)\s*\)$/);
  if (slash) return slash[1].endsWith('%') ? parseFloat(slash[1]) >= 100 : Number(slash[1]) >= 1;
  return true;
}

test.describe('Dane dzienne — przyklejona kolumna (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  test('@REQ: UI-TEMPLATE-ALIGNMENT - nagłówek i komórki pierwszej kolumny mają pełne tło', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const daily = new DailyReportPage(page);
    await daily.goto();

    const backgrounds = await daily.stickyBackgrounds();
    expect(backgrounds.length, 'tabela miesiąca powinna mieć przyklejoną kolumnę').toBeGreaterThan(1);
    for (const bg of backgrounds) expect(isOpaque(bg), bg).toBe(true);
  });
});
