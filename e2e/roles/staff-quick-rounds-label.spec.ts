import { test, expect } from '../fixtures/base-test';

/**
 * @REQ: NUR-BOARD
 *
 * Szybki obchód: przycisk nagrania notatki ma etykietę „Dyktuj”, bez dopisku „(1-klik)”
 * (decyzja Michała 2026-11-17).
 */
test.describe('Szybki obchód — etykieta przycisku nagrania (@REQ: NUR-BOARD)', () => {
  test('@REQ: NUR-BOARD - przycisk nagrania to „Dyktuj” bez dopisku', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    await page.goto('/staff');
    await page.locator('[data-slot="view-toggle"]:visible button[aria-label="Widok szybkiego obchodu"]').click();
    const record = page.getByRole('link', { name: 'Dyktuj', exact: true }).first();
    await expect(record).toBeVisible();
    await expect(page.getByText('(1-klik)')).toHaveCount(0);
  });
});
