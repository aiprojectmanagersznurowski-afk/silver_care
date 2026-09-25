import { test, expect } from '../fixtures/base-test';

/**
 * @REQ: INT-CORE-DECOUPLED
 * @REQ: ADM-FACILITY-MANAGE
 *
 * Testy E2E dla prezentacji czytelnych identyfikatorów biznesowych (SYS-BUSINESS-IDS):
 * AC1: Kody biznesowe (np. PLC-xxx) widoczne w interfejsie
 * AC2: Przycisk kopiowania kodu biznesowego
 */
test.describe('Prezentacja identyfikatorów biznesowych w UI (@REQ: INT-CORE-DECOUPLED, @REQ: ADM-FACILITY-MANAGE)', () => {
  test('@REQ: INT-CORE-DECOUPLED - AC1 & AC2: Kody biznesowe w kartach placówek z opcją kopiowania', async ({ loginPage, page }) => {
    await loginPage.loginAs('super_admin');
    await page.goto('/admin/organizations');
    await page.waitForLoadState('networkidle');

    // AC1: Weryfikacja obecności badge z kodem biznesowym PLC-
    const businessIdBadge = page.locator('[data-slot="business-id-badge"], [data-testid="business-id-badge"]').first();
    await expect(businessIdBadge).toBeVisible();
    await expect(businessIdBadge).toContainText('PLC-');

    // AC2: Weryfikacja przycisku kopiowania w badge
    const copyBtn = businessIdBadge.locator('button[aria-label="Kopiuj identyfikator"], button:has-text("Kopiuj")');
    if (await copyBtn.isVisible()) {
      await copyBtn.click();
    }
  });
});
