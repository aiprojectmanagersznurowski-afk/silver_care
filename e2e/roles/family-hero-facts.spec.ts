import { test, expect } from '../fixtures/base-test';
import { FamilyDashboardPage } from '../page-objects/FamilyDashboardPage';

/**
 * @REQ: FAM-DASHBOARD
 * @REQ: MDR-NO-INTERPRETATION
 *
 * Podsumowanie dnia w portalu rodziny pokazuje fakty (długość snu, kroki) albo „Brak danych” —
 * bez ocen samopoczucia zgadywanych z tekstu i bez emoji (decyzja Michała 2026-10-26).
 */
test.describe('Portal rodziny — podsumowanie dnia jako fakty (@REQ: FAM-DASHBOARD)', () => {
  test('@REQ: MDR-NO-INTERPRETATION - bez ocen i emoji, kafelki faktów', async ({ loginPage, page }) => {
    await loginPage.loginAs('family');
    const dashboard = new FamilyDashboardPage(page);
    await page.goto('/dashboard');
    await expect(dashboard.summaryHero).toBeVisible();

    const text = await dashboard.summaryHero.innerText();
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    for (const guess of ['Samopoczucie', 'Apetyt', 'W normie', 'Spokojny', 'Radosny', 'Obniżony', 'Brak opaski']) {
      expect(text, guess).not.toContain(guess);
    }
    await expect(dashboard.summaryHero.getByText('Długość snu')).toBeVisible();
    await expect(dashboard.summaryHero.getByText('Kroki', { exact: true })).toBeVisible();
  });
});
