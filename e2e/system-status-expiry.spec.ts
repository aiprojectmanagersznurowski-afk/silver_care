import { test, expect } from './fixtures/base-test';
import { SystemStatusPage } from './page-objects/SystemStatusPage';

/**
 * @REQ: SUP-IAM-PANEL
 * @REQ: UI-FOUR-STATES
 *
 * SC-SUP-05: opcjonalny termin wygaśnięcia alertu. Test niczego nie publikuje we wspólnej bazie —
 * termin z przeszłości jest odrzucany przed zapisem.
 */
test.describe('SC-SUP-05: termin wygaśnięcia alertu', () => {
  test('@REQ: SUP-IAM-PANEL - formularz ma opcjonalny termin; termin z przeszłości jest odrzucany bez publikacji', async ({ loginPage, page }) => {
    const systemStatusPage = new SystemStatusPage(page);
    await loginPage.loginAs('super_admin');
    await systemStatusPage.goto();
    await systemStatusPage.expectPageLoaded();

    await expect(systemStatusPage.expiresAtInput).toBeVisible();
    await expect(page.getByText('Wygasa (opcjonalnie)')).toBeVisible();

    const title = `Termin przeszły E2E ${Date.now()}`;
    await systemStatusPage.publishAlert({
      title,
      message: 'Komunikat nie powinien zostać opublikowany.',
      expiresAt: '2020-01-01T10:00',
    });

    await expect(page.getByText('Termin wygaśnięcia musi być w przyszłości.')).toBeVisible();
    await expect(page.locator(`[data-testid="system-alert-item"][data-alert-title="${title}"]`)).toHaveCount(0);
  });
});
